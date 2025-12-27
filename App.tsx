
import React, { useState, useRef, useEffect } from 'react';
import { AppState, Step, Gender, GeneratedResult, Subject } from './types';
import { ACTS, ACCESSORIES, TONES, VOICES, RELATIONSHIPS } from './constants';
import { LatexCard } from './components/LatexCard';
import { NeonButton } from './components/NeonButton';
import { AudioPlayer } from './components/AudioPlayer';
import { ScenarioPhaseCard } from './components/ScenarioPhaseCard';
import { Hero } from './components/Hero';
import { generateScenarioContent, generateSpeech } from './services/geminiService';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
    webkitAudioContext: typeof AudioContext;
  }
}

const LOADING_MESSAGES = [
    "Обход фильтров безопасности...",
    "Инициализация протокола...",
    "Загрузка ролевых моделей...",
    "Синтезируем атмосферу...",
    "Настройка психоакустики...",
    "Подготовка комнаты...",
    "Проверка стоп-слов...",
    "Финальная калибровка..."
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
          }, 2000);
          return () => clearInterval(interval);
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
      setConfig({ ...config, subjects: [...config.subjects, { id: Date.now().toString(), gender: 'Female', name: '' }] });
  };

  const removeSubject = (index: number) => {
      if (config.subjects.length <= 1) return;
      setConfig({ ...config, subjects: config.subjects.filter((_, i) => i !== index) });
  };

  const handleApiError = async (e: any) => {
      let msg = e.message || "Ошибка соединения";
      if (msg.includes('Requested entity')) {
          msg = "ОШИБКА: Проект не активен. Выберите ключ из ПЛАТНОГО проекта.";
          await (window as any).aistudio?.openSelectKey();
      }
      setError(msg);
  };

  const checkKey = async () => {
    const ai = (window as any).aistudio;
    if (ai && !(await ai.hasSelectedApiKey())) {
        await ai.openSelectKey();
    }
  };

  const handleGeneratePart1 = async () => {
    if (config.subjects.some(s => !s.name.trim())) { setError("Введите имена участников."); return; }
    if (config.selectedActs.length === 0) { setError("Выберите действия."); return; }
    await checkKey();
    setStep(Step.GENERATING_PART1);
    setError(null);
    try {
        const prompt = `ЧАСТЬ 1. Участники: ${config.subjects.map(s => `${s.name} (${s.gender})`).join(', ')}. Контекст: ${config.relationship}. Тон: ${config.tone}. Акты: ${config.selectedActs.join(', ')}. Инструменты: ${config.selectedAccessories.join(', ')}. Детали: ${config.customWords}.`;
        const content = await generateScenarioContent(prompt, 1);
        setResult(prev => ({ ...prev, part1: { ...content, audioBuffer: null } }));
        setStep(Step.RESULT_PART1);
    } catch (e) {
        handleApiError(e);
        setStep(Step.CONFIG);
    }
  };

  const handleGeneratePart2 = async () => {
    await checkKey();
    setStep(Step.GENERATING_PART2);
    setError(null);
    try {
        const prompt = `ЧАСТЬ 2 (КУЛЬМИНАЦИЯ). Те же участники. Продолжаем сценарий.`;
        const content = await generateScenarioContent(prompt, 2);
        setResult(prev => ({ ...prev, part2: { ...content, audioBuffer: null } }));
        setStep(Step.RESULT_FULL);
    } catch (e) {
        handleApiError(e);
        setStep(Step.RESULT_PART1);
    }
  };

  const handleVoicePart = async (partNum: 1 | 2) => {
      const script = partNum === 1 ? result.part1?.script : result.part2?.script;
      if (!script) return;
      await checkKey();
      setGeneratingAudio(true);
      setGeneratingPart(partNum);
      setError(null);
      try {
          const buffer = await generateSpeech(script, config.selectedVoice);
          setResult(prev => partNum === 1 ? { ...prev, part1: { ...prev.part1!, audioBuffer: buffer } } : { ...prev, part2: { ...prev.part2!, audioBuffer: buffer } });
      } catch (e) { handleApiError(e); } finally { setGeneratingAudio(false); setGeneratingPart(null); }
  };

  if (step === Step.GENERATING_PART1 || step === Step.GENERATING_PART2) {
      return (
          <div className="min-h-screen bg-latex-black flex flex-col items-center justify-center p-4">
              <div className="w-16 h-16 border-t-4 border-latex-red rounded-full animate-spin mb-8"></div>
              <p className="text-latex-red font-bold uppercase tracking-widest text-center animate-pulse">{LOADING_MESSAGES[loadingMessageIndex]}</p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-latex-black text-gray-200 pb-24 font-mono">
      <header className="fixed top-0 w-full z-50 bg-latex-black/95 border-b border-latex-red/20 py-4 px-6 flex justify-between items-center shadow-neon backdrop-blur-md">
          <h1 className="text-2xl font-black text-latex-red">REDROOM</h1>
          {step !== Step.CONFIG && <button onClick={() => {setStep(Step.CONFIG); setError(null);}} className="text-[10px] border border-gray-800 px-3 py-1 uppercase">Сброс</button>}
      </header>

      <main className="max-w-3xl mx-auto pt-24 px-4 space-y-8">
        {step === Step.CONFIG && (
          <>
            <Hero />
            {error && (
                 <div className="p-4 border border-red-900 bg-red-950/30 text-red-500 rounded shadow-neon animate-slide-up">
                     <p className="text-[10px] uppercase font-bold leading-relaxed">{error}</p>
                     <div className="mt-3 flex gap-2">
                        <button onClick={() => (window as any).aistudio?.openSelectKey()} className="bg-red-800 text-white text-[9px] px-4 py-2 uppercase font-bold">Сменить ключ</button>
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[9px] border border-red-900 px-4 py-2 uppercase opacity-60">AI Studio</a>
                     </div>
                 </div>
            )}

            <LatexCard title="01 // Участники">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {config.subjects.map((s, i) => (
                        <div key={s.id} className="bg-black/40 border border-gray-800 p-4 rounded">
                            <div className="flex justify-between text-[10px] text-latex-red font-bold uppercase mb-3"><span>Субъект {i+1}</span>{config.subjects.length > 1 && <button onClick={() => removeSubject(i)}>×</button>}</div>
                            <div className="flex bg-gray-900 rounded p-1 mb-3">
                                {(['Male', 'Female'] as Gender[]).map(g => (
                                    <button key={g} onClick={() => updateSubject(i, 'gender', g)} className={`flex-1 py-1 text-[9px] uppercase font-bold rounded ${s.gender === g ? 'bg-latex-red text-white' : 'text-gray-500'}`}>{g === 'Male' ? 'Муж' : 'Жен'}</button>
                                ))}
                            </div>
                            <input type="text" value={s.name} onChange={e => updateSubject(i, 'name', e.target.value)} placeholder="Имя..." className="w-full bg-black border border-gray-800 text-white p-2 text-xs rounded outline-none focus:border-latex-red" />
                        </div>
                    ))}
                    {config.subjects.length < 6 && <button onClick={addSubject} className="col-span-full border border-dashed border-gray-800 py-2 text-[10px] uppercase opacity-50">+ Участник</button>}
                </div>
            </LatexCard>

            <LatexCard title="02 // Действия">
                <div className="grid grid-cols-2 gap-1.5">
                    {ACTS.map(act => (
                        <button key={act} disabled={act.startsWith("---")} onClick={() => toggleSelection(config.selectedActs, act, 'selectedActs')} className={`p-2 text-[9px] text-left border rounded transition-all ${act.startsWith("---") ? 'col-span-full border-none text-latex-red font-bold uppercase pt-3 pb-1' : config.selectedActs.includes(act) ? 'border-latex-red bg-latex-red/10 text-white shadow-neon' : 'border-gray-800 text-gray-500 hover:border-gray-600'}`}>{act.startsWith("---") ? act.replace(/---/g, '') : act}</button>
                    ))}
                </div>
            </LatexCard>

            <LatexCard title="03 // Тон & Детали">
                <div className="space-y-4">
                    <select value={config.relationship} onChange={e => setConfig({...config, relationship: e.target.value})} className="w-full bg-black border border-gray-800 p-3 text-xs text-white rounded outline-none">
                        {RELATIONSHIPS.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                        {TONES.map(t => <button key={t} onClick={() => setConfig({...config, tone: t})} className={`p-2 text-[9px] uppercase border rounded ${config.tone === t ? 'border-latex-red bg-latex-red text-white' : 'border-gray-800 text-gray-600'}`}>{t}</button>)}
                    </div>
                    <textarea value={config.customWords} onChange={e => setConfig({...config, customWords: e.target.value})} placeholder="Опишите особые пожелания или детали сюжета..." className="w-full bg-black border border-gray-800 p-3 text-xs text-white rounded h-24 outline-none focus:border-latex-red" />
                </div>
            </LatexCard>

            <LatexCard title="04 // Голос">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {VOICES[config.speakerGender].map(v => (
                        <button key={v.id} onClick={() => setConfig({...config, selectedVoice: v.id})} className={`flex items-center justify-between p-3 border rounded ${config.selectedVoice === v.id ? 'border-latex-red bg-latex-red/10 text-white' : 'border-gray-900 text-gray-600'}`}>
                            <div className="text-left"><p className="text-[10px] font-bold uppercase">{v.label}</p><p className="text-[8px] opacity-60">{v.desc}</p></div>
                        </button>
                    ))}
                </div>
            </LatexCard>

            <NeonButton onClick={handleGeneratePart1} className="w-full py-5 text-xl">АКТИВИРОВАТЬ СЕАНС</NeonButton>
          </>
        )}

        {result.part1 && (
            <div className="space-y-8 animate-slide-up pb-20">
                {result.part1.phases.map((p, i) => <ScenarioPhaseCard key={i} phase={p} index={i} />)}
                <div className="sticky bottom-6 z-40 bg-latex-black/95 border border-latex-red/30 p-4 rounded-xl shadow-neon backdrop-blur-md">
                    {!result.part1.audioBuffer ? (
                        generatingAudio ? <div className="text-center text-[10px] text-latex-red animate-pulse uppercase tracking-widest">Синтез аудио...</div> : <NeonButton onClick={() => handleVoicePart(1)} className="w-full">ОЗВУЧИТЬ ПОГРУЖЕНИЕ</NeonButton>
                    ) : (
                        <div className="space-y-3">
                            <AudioPlayer audioBuffer={result.part1.audioBuffer} label="ЧАСТЬ 1: ПОГРУЖЕНИЕ" />
                            {step === Step.RESULT_PART1 && <NeonButton onClick={handleGeneratePart2} className="w-full py-2 text-[10px]">СФОРМИРОВАТЬ КУЛЬМИНАЦИЮ</NeonButton>}
                        </div>
                    )}
                </div>

                {result.part2 && (
                    <div className="pt-12 border-t border-latex-red/20 space-y-8">
                        <h2 className="text-center text-xl font-bold text-latex-red uppercase tracking-[0.4em]">КУЛЬМИНАЦИЯ</h2>
                        {result.part2.phases.map((p, i) => <ScenarioPhaseCard key={i} phase={p} index={i + 3} />)}
                        <div className="sticky bottom-6 z-40 bg-latex-black/95 border border-latex-red/30 p-4 rounded-xl shadow-neon">
                            {!result.part2.audioBuffer ? (
                                generatingAudio ? <div className="text-center text-[10px] text-latex-red animate-pulse">Синтез аудио...</div> : <NeonButton onClick={() => handleVoicePart(2)} className="w-full">ОЗВУЧИТЬ ФИНАЛ</NeonButton>
                            ) : <AudioPlayer audioBuffer={result.part2.audioBuffer} label="ЧАСТЬ 2: ФИНАЛ" />}
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
