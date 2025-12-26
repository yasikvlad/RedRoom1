
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Step, Gender, GeneratedResult, Subject } from './types';
import { ACTS, ACCESSORIES, TONES, VOICES, RELATIONSHIPS } from './constants';
import { LatexCard } from './components/LatexCard';
import { NeonButton } from './components/NeonButton';
import { AudioPlayer } from './components/AudioPlayer';
import { ScenarioPhaseCard } from './components/ScenarioPhaseCard';
import { Hero } from './components/Hero';
import { generateScenarioContent, generateSpeech } from './services/geminiService';

// Add type definition for speech recognition environment
declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
  }
}

const LOADING_MESSAGES = [
    "Анализирую психологический профиль...",
    "Загружаю протоколы доминирования...",
    "Подбираю инструменты наказания...",
    "Моделирую сцену...",
    "Синтезирую дыхание...",
    "Усиливаю сенсорную чувствительность...",
    "Расставляю участников...",
    "Регулирую уровень агрессии...",
    "Проверка стоп-слов...",
    "Готовность к сеансу..."
];

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.CONFIG);
  const [config, setConfig] = useState<AppState>({
    subjects: [
        { id: '1', gender: 'Male', name: '' },
        { id: '2', gender: 'Female', name: '' }
    ],
    selectedActs: [],
    selectedAccessories: [],
    customAccessories: '',
    tone: TONES[0],
    imageSize: '1K',
    relationship: RELATIONSHIPS[0],
    customWords: '',
    allowProfanity: false,
    allowInsults: false,
    speakerGender: 'Female',
    selectedVoice: 'Kore',
  });
  const [result, setResult] = useState<GeneratedResult>({ part1: null, part2: null });
  const [error, setError] = useState<string | null>(null);
  
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [generatingPart, setGeneratingPart] = useState<1 | 2 | null>(null);
  const [audioProgress, setAudioProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);

  const [previewLoadingId, setPreviewLoadingId] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
      if (step === Step.GENERATING_PART1 || step === Step.GENERATING_PART2 || generatingAudio) {
          const interval = setInterval(() => {
              setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
          }, 2500);
          return () => clearInterval(interval);
      } else {
          setLoadingMessageIndex(0);
      }
  }, [step, generatingAudio]);

  const toggleSelection = (list: string[], item: string, key: keyof AppState) => {
    if (item.startsWith("---")) return;
    const newList = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
    setConfig({ ...config, [key]: newList });
  };

  const updateSubject = (index: number, field: keyof Subject, value: any) => {
      const newSubjects = [...config.subjects];
      newSubjects[index] = { ...newSubjects[index], [field]: value };
      setConfig({ ...config, subjects: newSubjects });
  };

  const addSubject = () => {
      if (config.subjects.length >= 6) return;
      const newId = (config.subjects.length + 1).toString();
      setConfig({
          ...config,
          subjects: [...config.subjects, { id: newId, gender: 'Female', name: '' }]
      });
  };

  const removeSubject = (index: number) => {
      if (config.subjects.length <= 1) return;
      const newSubjects = config.subjects.filter((_, i) => i !== index);
      setConfig({ ...config, subjects: newSubjects });
  };

  const setSpeakerGender = (g: Gender) => {
      const newVoice = g === 'Male' ? 'Charon' : 'Kore';
      setConfig({
          ...config,
          speakerGender: g,
          selectedVoice: newVoice
      });
  };

  const handleApiError = (e: any) => {
      console.error(e);
      let msg = e.message || "Unknown error";
      
      if (msg.includes('API key') || msg.includes('400') || msg.includes('Requested entity was not found')) {
          msg = "ОШИБКА: Требуется API Ключ с активным Billing (оплатой). Модели озвучки недоступны на бесплатных тарифах.";
      }
      
      setError(msg);
  };

  // Helper to safely access aistudio from global window
  const checkAndOpenKeySelector = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
        const hasKey = await aiStudio.hasSelectedApiKey();
        if (!hasKey) {
            await aiStudio.openSelectKey();
            return true; // Selection triggered
        }
    }
    return false; // Key already exists or not in aistudio env
  };

  const handleVoicePreview = async (voiceId: string) => {
      if (previewLoadingId) return;
      await checkAndOpenKeySelector();
      setPreviewLoadingId(voiceId);
      setError(null);
      
      try {
          const isMale = VOICES.Male.some(v => v.id === voiceId);
          const sampleText = isMale
              ? "Тише... Почувствуй, как мой голос касается твоей кожи."
              : "Ммм... подойди ближе... я хочу прошептать тебе мой секрет.";
          
          const buffer = await generateSpeech(sampleText, voiceId);
          // Initialize AudioContext with 24000Hz as per TTS requirements
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
          const source = ctx.createBufferSource();
          source.buffer = buffer;
          source.connect(ctx.destination);
          source.start(0);
      } catch (e: any) {
          handleApiError(e);
      } finally {
          setPreviewLoadingId(null);
      }
  };

  const toggleVoiceInput = () => {
      if (isListening) {
          if (recognitionRef.current) recognitionRef.current.stop();
          setIsListening(false);
          return;
      }
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
          alert("Ваш браузер не поддерживает голосовой ввод.");
          return;
      }
      const recognition = new SpeechRecognition();
      recognition.lang = 'ru-RU';
      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          setConfig(prev => ({
              ...prev,
              customWords: prev.customWords ? `${prev.customWords} ${transcript}` : transcript
          }));
      };
      recognitionRef.current = recognition;
      recognition.start();
  };

  const getBasePrompt = (part: 1 | 2) => {
    const subjectsDesc = config.subjects.map((s, i) => 
        `${s.name ? s.name : `Участник ${i+1}`} (${s.gender === 'Male' ? 'Мужчина' : 'Женщина'})`
    ).join(', ');
    const speakerGenderRu = config.speakerGender === 'Male' ? 'Мужской (Доминант)' : 'Женский (Госпожа)';
    const profanityContext = config.allowProfanity ? "ЛЕКСИКА: Грязная, матерная, пошлая." : "ЛЕКСИКА: Жесткая, но без мата.";
    const insultContext = config.allowInsults ? "ПСИХОЛОГИЯ: Унижение, дегуманизация." : "ПСИХОЛОГИЯ: Строгая доминация.";

    return `СОЗДАЙ СЦЕНАРИЙ АУДИО-СЕССИИ (Часть ${part}). Длительность: 5 мин. Текст: 700 слов. Участники: ${subjectsDesc}. Отношения: ${config.relationship}. Голос: ${speakerGenderRu}. Тон: ${config.tone}. Действия: ${config.selectedActs.join(', ')}. Аксессуары: ${config.selectedAccessories.join(', ')}. ${profanityContext} ${insultContext} Пожелания: "${config.customWords}"`;
  }

  const handleGeneratePart1 = async () => {
    if (config.subjects.some(s => !s.name.trim())) { setError("Введите имена для всех участников."); return; }
    if (config.selectedActs.length === 0) { setError("Выберите действия."); return; }

    await checkAndOpenKeySelector();

    setStep(Step.GENERATING_PART1);
    setError(null);
    try {
      const content = await generateScenarioContent(getBasePrompt(1), 1);
      setResult(prev => ({ ...prev, part1: { ...content, audioBuffer: null } }));
      setStep(Step.RESULT_PART1);
    } catch (e: any) {
      handleApiError(e);
      setStep(Step.CONFIG);
    }
  };

  const handleVoicePart = async (partNum: 1 | 2) => {
      const scriptText = partNum === 1 ? result.part1?.script : result.part2?.script;
      if (!scriptText) return;
      
      await checkAndOpenKeySelector();
      setGeneratingAudio(true);
      setGeneratingPart(partNum);
      setError(null);
      
      const charCount = scriptText.length;
      const estimatedSeconds = Math.max(20, Math.ceil(charCount / 20));
      setEstimatedTimeRemaining(estimatedSeconds);
      setAudioProgress(0);
      const startTime = Date.now();
      
      const progressInterval = setInterval(() => {
          setAudioProgress(prev => {
              if (prev >= 98) return 99; 
              const elapsed = (Date.now() - startTime) / 1000;
              setEstimatedTimeRemaining(Math.max(0, Math.ceil(estimatedSeconds - elapsed)));
              return Math.min(99, (elapsed / estimatedSeconds) * 100);
          });
      }, 200);

      try {
          const audioBuffer = await generateSpeech(scriptText, config.selectedVoice);
          setResult(prev => partNum === 1 
              ? { ...prev, part1: { ...prev.part1!, audioBuffer } }
              : { ...prev, part2: { ...prev.part2!, audioBuffer } }
          );
          setAudioProgress(100);
      } catch (e: any) {
          handleApiError(e);
      } finally {
          clearInterval(progressInterval);
          setGeneratingAudio(false);
          setGeneratingPart(null);
      }
  };

  const handleGeneratePart2 = async () => {
    await checkAndOpenKeySelector();
    setStep(Step.GENERATING_PART2);
    setError(null);
    try {
        const content = await generateScenarioContent(getBasePrompt(2), 2);
        setResult(prev => ({ ...prev, part2: { ...content, audioBuffer: null } }));
        setStep(Step.RESULT_FULL);
    } catch(e: any) {
        handleApiError(e);
        setStep(Step.RESULT_PART1);
    }
  }

  const renderInlineProgress = () => (
     <div className="w-full max-w-md mx-auto">
        <div className="flex justify-between text-xs text-latex-red font-mono mb-2">
            <span>{audioProgress > 98 ? "Финальная обработка..." : "Синтез шёпота..."}</span>
            <span>{Math.round(audioProgress)}%</span>
        </div>
        <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden shadow-inner-glow">
           <div className="h-full bg-latex-red transition-all duration-300" style={{ width: `${audioProgress}%` }}></div>
        </div>
        <p className="text-center text-gray-600 text-[10px] mt-3 uppercase tracking-widest">
            {audioProgress > 98 ? "Почти готово..." : `Осталось: ~${estimatedTimeRemaining} сек.`}
        </p>
     </div>
  );

  const isTextGenerating = step === Step.GENERATING_PART1 || step === Step.GENERATING_PART2;
  if (isTextGenerating) {
    return (
        <div className="min-h-screen bg-latex-black flex flex-col items-center justify-center p-4 fixed inset-0 z-50">
            <div className="w-24 h-24 relative mb-8">
                <div className="absolute inset-0 border-4 border-latex-red/30 rounded-full animate-spin"></div>
                <div className="absolute inset-0 border-4 border-latex-red border-t-transparent rounded-full animate-spin"></div>
            </div>
            <h2 className="text-xl font-bold text-latex-red animate-pulse text-center tracking-widest uppercase">
                {LOADING_MESSAGES[loadingMessageIndex]}
            </h2>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-latex-black text-gray-200 selection:bg-latex-red selection:text-white pb-24 font-mono">
      <header className="fixed top-0 w-full z-50 bg-latex-black/90 backdrop-blur-md border-b border-latex-red/20 shadow-neon">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tighter text-latex-red">REDROOM<span className="text-xs opacity-50">GIT</span></h1>
          {(step !== Step.CONFIG) && (
             <button onClick={() => {setStep(Step.CONFIG); setError(null);}} className="text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition-colors border border-gray-800 px-3 py-1 rounded">Новый Сеанс</button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto pt-24 px-4">
        {step === Step.CONFIG && (
          <div className="space-y-8 animate-fade-in">
             <Hero />
             
             {error && (
                 <div className="p-6 border border-red-900 bg-red-950/40 text-red-500 rounded-xl shadow-neon space-y-4">
                     <div className="flex items-center gap-3">
                        <svg className="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                        <p className="font-bold uppercase text-xs tracking-wider">{error}</p>
                     </div>
                     
                     <div className="grid grid-cols-1 gap-3 border-t border-red-900/30 pt-4">
                        <button onClick={async () => await (window as any).aistudio?.openSelectKey()} className="w-full py-3 bg-red-900 text-white font-bold uppercase text-xs tracking-widest hover:bg-red-800 transition-all rounded">1. ВЫБРАТЬ API КЛЮЧ (Select Key)</button>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-center py-2 text-[10px] text-gray-400 border border-gray-800 rounded uppercase hover:text-white transition-colors">Создать новый ключ (AI Studio)</a>
                        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-center py-2 text-[10px] text-gray-400 border border-gray-800 rounded uppercase hover:text-white transition-colors">Настроить оплату (Billing Guide)</a>
                     </div>
                 </div>
             )}

             <LatexCard title="01 // Участники">
               <div className="space-y-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {config.subjects.map((subject, index) => (
                         <div key={subject.id} className="bg-black/40 border border-gray-800 p-4 rounded-lg">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] text-latex-red font-bold uppercase tracking-[0.2em]">Субъект {index + 1}</span>
                                {config.subjects.length > 1 && (
                                    <button onClick={() => removeSubject(index)} className="text-gray-600 hover:text-red-500">×</button>
                                )}
                            </div>
                            <div className="space-y-4">
                                 <div className="flex bg-gray-900 rounded p-1">
                                    {(['Male', 'Female'] as Gender[]).map(g => (
                                        <button key={g} onClick={() => updateSubject(index, 'gender', g)} className={`flex-1 py-1.5 rounded text-[10px] uppercase font-bold transition-all ${subject.gender === g ? 'bg-latex-red text-white' : 'text-gray-500'}`}>{g === 'Male' ? 'Муж' : 'Жен'}</button>
                                    ))}
                                 </div>
                                 <input type="text" value={subject.name} onChange={(e) => updateSubject(index, 'name', e.target.value)} placeholder="Имя / Роль..." className="w-full bg-black border border-gray-800 text-white p-2 text-xs rounded focus:border-latex-red outline-none" />
                            </div>
                         </div>
                     ))}
                   </div>
                   {config.subjects.length < 6 && (
                       <button onClick={addSubject} className="w-full py-2 border border-dashed border-gray-800 text-gray-600 hover:text-white text-[10px] uppercase tracking-widest">+ Добавить участника</button>
                   )}
               </div>
             </LatexCard>

             <LatexCard title="02 // Протоколы">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {ACTS.map(act => (
                        <button key={act} disabled={act.startsWith("---")} onClick={() => toggleSelection(config.selectedActs, act, 'selectedActs')} className={`p-2.5 text-[10px] text-left rounded border transition-all ${act.startsWith("---") ? 'col-span-full border-none text-latex-red font-bold uppercase pt-4 cursor-default' : config.selectedActs.includes(act) ? 'border-latex-red bg-latex-red/10 text-white' : 'border-gray-800 bg-black/20 text-gray-500'}`}>
                            {!act.startsWith("---") && (config.selectedActs.includes(act) ? '⦿ ' : '○ ')}
                            {act.startsWith("---") ? act.replace(/---/g, '') : act}
                        </button>
                    ))}
                </div>
             </LatexCard>

             <LatexCard title="03 // Голос Режиссера">
                 <div className="space-y-6">
                    <div className="flex bg-gray-900 rounded p-1">
                        {(['Male', 'Female'] as Gender[]).map(g => (
                            <button key={g} onClick={() => setSpeakerGender(g)} className={`flex-1 py-2 rounded text-[10px] uppercase font-bold transition-all ${config.speakerGender === g ? 'bg-gray-800 text-white' : 'text-gray-500'}`}>{g === 'Male' ? 'Мужской' : 'Женский'}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {VOICES[config.speakerGender].map(voice => (
                            <button key={voice.id} onClick={() => setConfig({...config, selectedVoice: voice.id})} className={`flex items-center justify-between p-3 rounded border text-left transition-all ${config.selectedVoice === voice.id ? 'border-latex-red bg-latex-red/10 text-white' : 'border-gray-900 text-gray-500 hover:border-gray-700'}`}>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold uppercase">{voice.label}</span>
                                    <span className="text-[9px] opacity-60">{voice.desc}</span>
                                </div>
                                <div onClick={(e) => {e.stopPropagation(); handleVoicePreview(voice.id);}} className="p-1 hover:text-white cursor-pointer">
                                    {previewLoadingId === voice.id ? '...' : '▶'}
                                </div>
                            </button>
                        ))}
                    </div>
                 </div>
             </LatexCard>

             <div className="sticky bottom-6 z-40">
                <NeonButton onClick={handleGeneratePart1} className="w-full text-lg py-5 shadow-neon">НАЧАТЬ СЕАНС (ЧАСТЬ 1)</NeonButton>
             </div>
          </div>
        )}

        {(step === Step.RESULT_PART1 || step === Step.RESULT_FULL) && result.part1 && (
            <div className="space-y-8 animate-slide-up pb-20">
                {result.part1.phases.map((phase, idx) => (
                    <ScenarioPhaseCard key={idx} phase={phase} index={idx} />
                ))}

                <div className="mt-8 flex flex-col items-center gap-6 sticky bottom-6 z-40 px-4">
                    <div className="bg-latex-black/95 border border-latex-red/30 p-3 rounded-xl shadow-neon w-full md:w-auto max-w-2xl flex flex-col gap-4">
                        {!result.part1.audioBuffer ? (
                             (generatingAudio && generatingPart === 1) ? renderInlineProgress() : (
                                 <NeonButton onClick={() => handleVoicePart(1)} className="w-full md:px-12 py-3 text-sm">ЗАПУСК АУДИО-ГИДА (Ч. 1)</NeonButton>
                             )
                        ) : (
                             <div className="flex flex-col gap-3">
                                <AudioPlayer audioBuffer={result.part1.audioBuffer} label="ЧАСТЬ 1: ПОГРУЖЕНИЕ" />
                                <NeonButton onClick={() => window.open('https://secure.wayforpay.com/button/b9f169173594b', '_blank')} variant="secondary" className="py-2 text-[9px] border-latex-red/20">ПОДДЕРЖАТЬ РАЗРАБОТЧИКА ❤️</NeonButton>
                             </div>
                        )}
                    </div>
                </div>

                {step === Step.RESULT_PART1 && result.part1.audioBuffer && (
                    <div className="text-center py-12">
                        <NeonButton onClick={handleGeneratePart2} className="px-12 py-4">СГЕНЕРИРОВАТЬ ФИНАЛ (ЧАСТЬ 2)</NeonButton>
                    </div>
                )}

                {step === Step.RESULT_FULL && result.part2 && (
                    <div className="space-y-6 mt-12 border-t border-latex-red/20 pt-12">
                        <h2 className="text-2xl font-bold text-center mb-8 text-latex-red uppercase tracking-[0.5em]">КУЛЬМИНАЦИЯ</h2>
                        {result.part2.phases.map((phase, idx) => (
                             <ScenarioPhaseCard key={idx} phase={phase} index={idx + 3} />
                        ))}
                        <div className="mt-8 flex justify-center sticky bottom-6 z-40 px-4">
                            <div className="bg-latex-black/95 border border-latex-red/30 p-3 rounded-xl shadow-neon w-full md:w-auto max-w-2xl flex justify-center">
                                {!result.part2.audioBuffer ? (
                                    (generatingAudio && generatingPart === 2) ? renderInlineProgress() : (
                                        <NeonButton onClick={() => handleVoicePart(2)} className="w-full md:px-12 py-3">ЗАПУСК АУДИО-ГИДА (Ч. 2)</NeonButton>
                                    )
                                ) : (
                                    <AudioPlayer audioBuffer={result.part2.audioBuffer} label="ЧАСТЬ 2: ФИНАЛ" />
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}
      </main>
    </div>
  );
};

export default App;
