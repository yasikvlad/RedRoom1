import { GoogleGenAI, Modality, Type } from "@google/genai";

// Helper to safely get API Key
const getApiKey = () => {
    if (typeof process !== 'undefined' && process.env) {
        return process.env.API_KEY;
    }
    return undefined;
};

// Helper to decode Base64 to ArrayBuffer (for audio)
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Helper to decode audio data using AudioContext
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  // Ensure the buffer is aligned by creating a copy if needed
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

// Helper to concatenate multiple AudioBuffers
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

// Helper to split long text into smaller chunks for stable TTS generation
function chunkText(text: string, maxLength: number = 1000): string[] {
    const chunks: string[] = [];
    let currentPos = 0;

    // Remove complex formatting but keep pauses for the model
    const sanitizedText = text.replace(/\[PAUSE:.*?\]/g, " ... ").replace(/\[BREATH\]/g, " (вдох) ");

    while (currentPos < sanitizedText.length) {
        if (sanitizedText.length - currentPos <= maxLength) {
            chunks.push(sanitizedText.substring(currentPos));
            break;
        }

        // Try to split at a sentence end or paragraph
        let splitPos = sanitizedText.lastIndexOf('.', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = sanitizedText.lastIndexOf('?', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = sanitizedText.lastIndexOf('!', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = sanitizedText.lastIndexOf('\n', currentPos + maxLength);
        if (splitPos <= currentPos) splitPos = sanitizedText.lastIndexOf(' ', currentPos + maxLength);
        
        // If no good split point found, just hard cut
        if (splitPos <= currentPos) splitPos = currentPos + maxLength;

        chunks.push(sanitizedText.substring(currentPos, splitPos + 1));
        currentPos = splitPos + 1;
    }
    return chunks.map(c => c.trim()).filter(c => c.length > 0);
}

// Helper to convert AudioBuffer to WAV Blob for downloading
export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numOfChan = buffer.numberOfChannels;
  const length = buffer.length * numOfChan * 2 + 44;
  const bufferArr = new ArrayBuffer(length);
  const view = new DataView(bufferArr);
  const channels = [];
  let i;
  let sample;
  let offset = 0;
  let pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(buffer.sampleRate);
  setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this example)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for(i = 0; i < buffer.numberOfChannels; i++)
    channels.push(buffer.getChannelData(i));

  while(pos < buffer.length) {
    for(i = 0; i < numOfChan; i++) {
      sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
      view.setInt16(44 + offset, sample, true);
      offset += 2;
    }
    pos++;
  }

  return new Blob([bufferArr], { type: 'audio/wav' });

  function setUint16(data: number) {
    view.setUint16(pos, data, true);
    pos += 2;
  }
  function setUint32(data: number) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

// Updated interface to match the new structured response
interface ScenarioResponseData {
  phases: {
      title: string;
      duration: string;
      pose: string;
      inventory: string;
      action: string;
      dirtyTalk: string;
      sensorics: string;
  }[];
  script: string;
}

export const generateScenarioContent = async (
  prompt: string,
  part: 1 | 2
): Promise<ScenarioResponseData> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key not found. Please select an API Key.");
  
  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    Роль: Ты — Голос-Диктатор (Voice Dictator) и Иммерсивный Режиссер. 
    Твоя сущность: Ты не просто читаешь текст, ты — невидимое присутствие в комнате. Ты — Власть.
    
    Твоя задача — сгенерировать ответ в формате JSON с двумя главными полями: 'phases' и 'script'.

    **1. STRUCTURED CARDS (phases):**
    Разбей эту часть сеанса (Часть ${part}) на 1-3 логические фазы (сцены). Для каждой фазы создай объект с полями:
    - **title**: Название фазы (например, "ФАЗА 1: ПОДГОТОВКА И РАЗНОС").
    - **duration**: Примерное время (например, "0-5 минут").
    - **pose**: Четкое описание позы (геометрия тел). Кратко и емко.
    - **inventory**: Какой инвентарь используется в этот момент (или "Руки", "Голос").
    - **action**: Описание действия от первого лица (Диктатора) или описание происходящего. Жестко, конкретно.
    - **dirtyTalk**: Одна-две ярких, грязных фразы, которые Диктатор говорит (или заставляет сказать).
    - **sensorics**: Описание звуков, запахов, тактильных ощущений (SFX).

    **2. AUDIO SCRIPT (script):**
    Полный, связный текст для озвучки всей части целиком.
       - **DURATION:** The script MUST be extensive. It represents exactly 5 minutes of speech. **TARGET WORD COUNT: 600-800 WORDS.** Do not summarize. Write every word to be spoken.
       - Обращайся к участникам с абсолютным авторитетом.
       - Используй императив и гипнотическое описание.
       - Используй маркеры [PAUSE: 5s] и [BREATH] для управления темпом, но полагайся в основном на длинный, насыщенный текст.
       - Тон должен соответствовать указанному контексту отношений.

    Контекст: Безопасная среда, BDSM-эстетика, Power Play.
    Язык: Русский.
  `;

  // 1. Generate Text Scenario
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: {
      systemInstruction: systemInstruction,
      temperature: 1.0, 
      responseMimeType: "application/json",
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
      throw new Error("No text generated from model");
  }

  try {
      const data = JSON.parse(response.text) as ScenarioResponseData;
      return { 
          phases: data.phases || [],
          script: data.script || "Сценарий отсутствует."
      };
  } catch (e) {
      console.error("JSON parsing error", e);
      // Fallback
      return {
          phases: [{
              title: "ОШИБКА ГЕНЕРАЦИИ",
              duration: "0:00",
              pose: "Ошибка",
              inventory: "-",
              action: "Не удалось структурировать ответ нейросети.",
              dirtyTalk: "...",
              sensorics: "..."
          }],
          script: response.text || ""
      };
  }
};

export const generateSpeech = async (text: string, voiceName: string): Promise<AudioBuffer> => {
    let apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key not found. Please check your settings.");

    const ai = new GoogleGenAI({ apiKey });
    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});

    // To prevent voice changes and cut-offs in 5-minute scripts, we must use chunking.
    const textChunks = chunkText(text);
    const audioBuffers: AudioBuffer[] = [];

    for (let i = 0; i < textChunks.length; i++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: textChunks[i] }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName },
                        },
                    },
                },
            });

            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
                const buffer = await decodeAudioData(
                    decode(base64Audio),
                    outputAudioContext,
                    24000,
                    1
                );
                audioBuffers.push(buffer);
            }
        } catch (error) {
            console.error(`Error generating speech for chunk ${i}:`, error);
            // Skip failed chunks instead of failing the whole thing
        }
    }

    if (audioBuffers.length === 0) throw new Error("Could not generate audio content.");

    return concatAudioBuffers(outputAudioContext, audioBuffers);
};