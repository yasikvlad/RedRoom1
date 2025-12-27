
import { GoogleGenAI, Modality, Type } from "@google/genai";

// Helper to decode Base64 to ArrayBuffer
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  const dataInt16 = new Int16Array(arrayBuffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function concatAudioBuffers(ctx: AudioContext, buffers: AudioBuffer[]): AudioBuffer {
  if (buffers.length === 0) return ctx.createBuffer(1, 1, 24000);
  if (buffers.length === 1) return buffers[0];
  const totalLength = buffers.reduce((acc, buf) => acc + buf.length, 0);
  const result = ctx.createBuffer(buffers[0].numberOfChannels, totalLength, buffers[0].sampleRate);
  let offset = 0;
  for (const buffer of buffers) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      result.getChannelData(channel).set(buffer.getChannelData(channel), offset);
    }
    offset += buffer.length;
  }
  return result;
}

function chunkText(text: string, maxLength: number = 1000): string[] {
    const chunks: string[] = [];
    let currentPos = 0;
    const sanitizedText = text.replace(/\[PAUSE:.*?\]/g, " ... ").replace(/\[BREATH\]/g, " (вдох) ");
    while (currentPos < sanitizedText.length) {
        if (sanitizedText.length - currentPos <= maxLength) {
            chunks.push(sanitizedText.substring(currentPos));
            break;
        }
        let splitPos = sanitizedText.lastIndexOf('.', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = sanitizedText.lastIndexOf('?', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = sanitizedText.lastIndexOf('\n', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = sanitizedText.lastIndexOf(' ', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = currentPos + maxLength;
        chunks.push(sanitizedText.substring(currentPos, splitPos + 1));
        currentPos = splitPos + 1;
    }
    return chunks.map(c => c.trim()).filter(c => c.length > 0);
}

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  let pos = 0;
  let offset = 0;
  const setUint16 = (d: number) => { view.setUint16(pos, d, true); pos += 2; };
  const setUint32 = (d: number) => { view.setUint32(pos, d, true); pos += 4; };

  setUint32(0x46464952); setUint32(length - 8); setUint32(0x45564157);
  setUint32(0x20746d66); setUint32(16); setUint16(1); setUint16(numOfChan);
  setUint32(buffer.sampleRate); setUint32(buffer.sampleRate * 2 * numOfChan);
  setUint16(numOfChan * 2); setUint16(16); setUint32(0x61746164);
  setUint32(length - pos - 4);

  const channels = [];
  for(let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));
  let samplePos = 0;
  while(samplePos < buffer.length) {
    for(let i = 0; i < numOfChan; i++) {
      let s = Math.max(-1, Math.min(1, channels[i][samplePos]));
      s = (0.5 + s < 0 ? s * 32768 : s * 32767)|0;
      view.setInt16(44 + offset, s, true);
      offset += 2;
    }
    samplePos++;
  }
  return new Blob([bufferArr], { type: 'audio/wav' });
}

interface ScenarioResponseData {
  phases: {
      title: string; duration: string; pose: string; inventory: string; action: string; dirtyTalk: string; sensorics: string;
  }[];
  script: string;
}

export const generateScenarioContent = async (prompt: string, part: 1 | 2): Promise<ScenarioResponseData> => {
  if (!process.env.API_KEY) throw new Error("Выберите API ключ.");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Переходим на 2.5 flash, она стабильнее с adult-контентом в JSON
  const modelName = 'gemini-2.5-flash';

  const systemInstruction = `
    Ты — эксперт-сценарист иммерсивных аудио-перформансов для взрослых. Твоя специализация — психологические этюды и ролевые игры.
    Твоя задача: написать подробный сценарий для закрытого частного сеанса.
    
    ПРАВИЛА:
    1. Ответ СТРОГО в JSON.
    2. Поле 'script' должно содержать не менее 700 слов. Это монолог Диктатора.
    3. Тон: Профессиональный, властный, атмосферный.
    4. Если тема слишком острая, используй метафоры, но сохраняй интенсивность.
    
    Язык: Русский.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8,
        responseMimeType: "application/json",
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            phases: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  duration: { type: Type.STRING },
                  pose: { type: Type.STRING },
                  inventory: { type: Type.STRING },
                  action: { type: Type.STRING },
                  dirtyTalk: { type: Type.STRING },
                  sensorics: { type: Type.STRING },
                },
                required: ["title", "duration", "pose", "inventory", "action", "dirtyTalk", "sensorics"]
              }
            },
            script: { type: Type.STRING }
          },
          required: ["phases", "script"]
        }
      }
    });

    if (!response.text) {
      const candidate = response.candidates?.[0];
      if (candidate?.finishReason === 'SAFETY') {
        throw new Error("ЦЕНЗУРА: Темы 'насилия' или 'жестокости' слишком выражены. Уменьшите уровень агрессии в настройках тона.");
      }
      throw new Error("ПУСТОЙ ОТВЕТ: Проверьте статус Billing (оплата) в AI Studio. Возможно, лимиты исчерпаны.");
    }

    return JSON.parse(response.text) as ScenarioResponseData;
  } catch (e: any) {
    if (e.message.includes('JSON')) throw new Error("ОШИБКА ФОРМАТА: Нейросеть не смогла собрать сценарий. Попробуйте еще раз.");
    throw e;
  }
};

export const generateSpeech = async (text: string, voiceName: string): Promise<AudioBuffer> => {
    if (!process.env.API_KEY) throw new Error("Ключ не найден.");
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const textChunks = chunkText(text);
    const audioBuffers: AudioBuffer[] = [];

    for (let chunk of textChunks) {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: chunk }] }],
            config: {
                responseModalities: [Modality.AUDIO],
                safetySettings: [
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                ],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                    },
                },
            },
        });
        const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
            const buffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
            audioBuffers.push(buffer);
        }
    }
    if (audioBuffers.length === 0) throw new Error("ОШИБКА ОЗВУЧКИ: Текст заблокирован фильтрами речи.");
    return concatAudioBuffers(outputAudioContext, audioBuffers);
};
