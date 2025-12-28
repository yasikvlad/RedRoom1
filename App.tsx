import React, { useState, useRef, useEffect } from 'react';
import { AppState, Step, Gender, GeneratedResult, Subject } from './types';
import { ACTS, ACCESSORIES, TONES, VOICES, RELATIONSHIPS } from './constants';
import { LatexCard } from './components/LatexCard';
import { NeonButton } from './components/NeonButton';
import { AudioPlayer } from './components/AudioPlayer';
import { ScenarioPhaseCard } from './components/ScenarioPhaseCard';
import { Hero } from './components/Hero';
import { generateScenarioContent, generateSpeech } from './services/geminiService';

const LOADING_MESSAGES = [
    "ВЗЛАМЫВАЕМ ЦЕНЗУРУ...",
    "ИНИЦИАЛИЗАЦИЯ ТЕМНОЙ КОМНАТЫ...",
    "ЗАГРУЗКА РОЛЕВЫХ МОДЕЛЕЙ...",
    "СИНТЕЗ АТМОСФЕРЫ...",
    "НАСТРОЙКА ПСИХОАКУСТИКИ...",
    "ПОДГОТОВКА ИНСТРУМЕНТОВ...",
    "ОБХОД ПРОТОКОЛОВ БЕЗОПАСНОСТИ...",
    "РЕЖИМ MAXIMUM INTENSITY ВКЛЮЧЕН..."
];

const SECONDS_PER_CHUNK = 3.5; 

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.CONFIG);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
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
    allowProfanity: true,
    allowInsults: true,
    speakerGender: 'Female',
    selectedVoice: 'Kore',
  });
  const [result, setResult] = useState<GeneratedResult>({ part1: null, part2: null });
  const [error, setError] = useState<string | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0); 
  const [audioTimeLeft, setAudioTimeLeft] = useState(0);
  
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const checkKey = async () => {
        const selected = await (window as any).aistudio?.hasSelectedApiKey();
        setHasKey(!!selected);
    };
    checkKey();
  }, []);

  useEffect(() => {
      if (step === Step.GENERATING_PART1 || step === Step.GENERATING_PART2 || (generatingAudio && audioProgress === 0)) {
          const interval = setInterval(() => {
              setLoadingMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
          }, 2000);
          return () => clearInterval(interval);
      }
  }, [step, generatingAudio, audioProgress]);

  useEffect(() => {
    if (generatingAudio && audioTimeLeft > 0) {
      timerRef.current = window.setInterval(() => {
        setAudioTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [generatingAudio, audioTimeLeft]);

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

  const handleSelectKey = async () => {
      await (window as any).aistudio?.openSelectKey();
      setHasKey(true);
      setError(null);
  };

  const handleApiError = async (e: any) => {
      let msg = e.message || "ОШИБКА ПОДКЛЮЧЕНИЯ";
      if (msg.includes('SAFETY') || msg.includes('candidates')) {
          msg = "API ЗАБЛОКИРОВАЛ КОНТЕНТ. \n1. Убедитесь, что в AI Studio в разделе Safety Settings все ползунки стоят в положении OFF (Block none).\n2. Попробуйте использовать менее экстремальные акты или смените API ключ на платный.";
      } else if (msg.toLowerCase().includes('429')) {
          msg = "ЛИМИТ API ИСЧЕРПАН. ПОЖАЛУЙСТА, ПОДОЖДИТЕ 60 СЕКУНД ИЛИ СМЕНИТЕ КЛЮЧ.";
      }
      setError(msg.toUpperCase());
  };

  const handleGeneratePart1 = async () => {
    if (config.subjects.some(s => !s.name.trim())) { setError("УКАЖИТЕ ИМЕНА ВСЕХ УЧАСТНИКОВ"); return; }
    if (config.selectedActs.length === 0) { setError("ВЫБЕРИТЕ ХОТЯ БЫ ОДНО ДЕЙСТВИЕ"); return; }
    
    setError(null);
    setStep(Step.GENERATING_PART1);
    
    try {
        const prompt = `ПЕРФОРМАНС ДЛЯ: ${config.subjects.map(s => `${s.name} (${s.gender})`).join(', ')}. 
        КОНТЕКСТ: ${config.relationship}. 
        ТОНАЛЬНОСТЬ: ${config.tone}. 
        АКТЫ: ${config.selectedActs.join(', ')}. 
        ИНВЕНТАРЬ: ${config.selectedAccessories.join(', ')}. 
        КАСТОМ: ${config.customWords}. 
        ТРЕБОВАНИЕ: Максимально грязно, с матом, без цензуры. Протокол REDROOM.`;
        
        const content = await generateScenarioContent(prompt, 1);
        setResult(prev => ({ ...prev, part1: { ...content, audioBuffer: null } }));
        setStep(Step.RESULT_PART1);
    } catch (e) {
        handleApiError(e);
        setStep(Step.CONFIG);
    }
  };

  const handleGeneratePart2 = async () => {
    setStep(Step.GENERATING_PART2);
    setError(null);
    try {
        const prompt = `ПРОДОЛЖЕНИЕ ПРОТОКОЛА REDROOM. КУЛЬМИНАЦИЯ И РАЗВЯЗКА. ПРЕДЕЛЬНАЯ ИНТЕНСИВНОСТЬ. ФИЗИОЛОГИЧЕСКАЯ РАЗРЯДКА ДЛЯ ${config.subjects.map(s => s.name).join(' И ')}. ГРЯЗНО, С МАТОМ.`;
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
      
      setGeneratingAudio(true);
      setAudioProgress(0);
      setError(null);
      
      try {
          const estimatedChunks = Math.ceil(script.length / 800);
          setAudioTimeLeft(Math.ceil(estimatedChunks * SECONDS_PER_CHUNK));
          const buffer = await generateSpeech(script, config.selectedVoice, (current, total) => {
              setAudioProgress(Math.floor((current / total) * 100));
          });
          setResult(prev => partNum === 1 
            ? { ...prev, part1: { ...prev.part1!, audioBuffer: buffer } } 
            : { ...prev, part2: { ...prev.part2!, audioBuffer: buffer } }
          );
      } catch (e) { 
          handleApiError(e); 
      } finally { 
          setGeneratingAudio(false); 
          setAudioProgress(0);
      }
  };

  if (hasKey === false) {
      return (
          <div className="min-h-screen bg-latex-black flex flex-col items-center justify-center p-8 text-center space-y-12">
              <Hero />
              <div className="max-w-md space-y-6">
                  <h2 className="text-2xl font-black text-latex-red uppercase tracking-widest">ДОСТУП ОГРАНИЧЕН</h2>
                  <p className="text-gray-400 text-sm">Для работы ИИ-режиссера требуется ваш персональный API ключ.</p>
                  <NeonButton onClick={handleSelectKey} className="w-full py-6">ВВЕСТИ КЛЮЧ</NeonButton>
              </div>
          </div>
      );
  }

  if (step === Step.GENERATING_PART1 || step === Step.GENERATING_PART2) {
      return (
          <div className="min-h-screen bg-latex-black flex flex-col items-center justify-center p-4">
              <div className="w-24 h-24 border-t-4 border-latex-red rounded-full animate-spin mb-12 shadow-[0_0_40px_rgba(138,0,0,0.6)]"></div>
              <p className="text-latex-red font-black uppercase tracking-[0.5em] text-center animate-pulse text-xl drop-shadow-neon px-4">
                {LOADING_MESSAGES[loadingMessageIndex]}
              </p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-latex-black text-gray-200 pb-32 font-mono selection:bg-latex-red selection:text-white">
      <header className="fixed top-0 w-full z-50 bg-latex-black/95 border-b border-latex-red/30 py-6 px-8 flex justify-between items-center backdrop-blur-xl shadow-neon">
          <h1 className="text-4xl font-black text-latex-red tracking-tighter hover:text-white transition-colors cursor-default">REDROOM</h1>
          <div className="flex gap-4">
            <button onClick={handleSelectKey} className="hidden md:block text-[10px] border border-gray-700 px-4 py-2 uppercase font-black hover:border-white transition-all">СМЕНИТЬ КЛЮЧ</button>
            {step !== Step.CONFIG && (
                <button onClick={() => {setStep(Step.CONFIG); setError(null);}} className="text-xs border-2 border-latex-red px-6 py-2 uppercase font-black hover:bg-latex-red transition-all">СБРОСИТЬ</button>
            )}
          </div>
      </header>

      <main className="max-w-4xl mx-auto pt-32 px-4 space-y-12">
        {step === Step.CONFIG && (
          <>
            <Hero />
            {error && (
                 <div className="p-8 border-2 border-latex-red bg-latex-red/10 text-latex-brightRed rounded-2xl shadow-neon animate-slide-up overflow-hidden">
                     <h2 className="text-xl font-black mb-4 tracking-widest">ВНИМАНИЕ</h2>
                     <p className="text-xs font-bold leading-relaxed mb-6 whitespace-pre-wrap">{error}</p>
                     <div className="flex flex-wrap gap-4">
                        <NeonButton onClick={handleSelectKey} className="text-xs px-8 py-3">ОБНОВИТЬ КЛЮЧ</NeonButton>
                        <button onClick={() => setError(null)} className="text-xs uppercase font-black opacity-50 hover:opacity-100 transition-opacity">ЗАКРЫТЬ</button>
                     </div>
                 </div>
            )}

            <LatexCard title="01 // УЧАСТНИКИ ПЕРФОРМАНСА">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {config.subjects.map((s, i) => (
                        <div key={s.id} className="bg-black/80 border-2 border-gray-900 p-6 rounded-2xl shadow-inner relative group">
                            <div className="flex justify-between items-center mb-6">
                                <span className="text-xs text-latex-red font-black uppercase tracking-[0.3em]">АКТЕР #{i+1}</span>
                                {config.subjects.length > 2 && (
                                    <button onClick={() => removeSubject(i)} className="text-gray-600 hover:text-latex-red transition-colors text-xl">×</button>
                                )}
                            </div>
                            <div className="flex bg-gray-950 rounded-xl p-1.5 mb-6 border border-gray-800">
                                {(['Male', 'Female'] as Gender[]).map(g => (
                                    <button key={g} onClick={() => updateSubject(i, 'gender', g)} className={`flex-1 py-3 text-xs uppercase font-black rounded-lg transition-all ${s.gender === g ? 'bg-latex-red text-white shadow-neon' : 'text-gray-600 hover:text-gray-400'}`}>
                                        {g === 'Male' ? 'ОН' : 'ОНА'}
                                    </button>
                                ))}
                            </div>
                            <input 
                                type="text" 
                                value={s.name} 
                                onChange={e => updateSubject(i, 'name', e.target.value)} 
                                placeholder="ВВЕДИТЕ ИМЯ..." 
                                className="w-full bg-black border-2 border-gray-900 text-white p-4 text-sm rounded-xl outline-none focus:border-latex-red uppercase tracking-widest font-black transition-all" 
                            />
                        </div>
                    ))}
                    {config.subjects.length < 6 && (
                        <button onClick={addSubject} className="col-span-full border-4 border-dashed border-gray-900 rounded-2xl py-6 text-xs uppercase font-black text-gray-700 hover:border-latex-red hover:text-latex-red transition-all">+ ДОБАВИТЬ УЧАСТНИКА</button>
                    )}
                </div>
            </LatexCard>

            <LatexCard title="02 // ПАРТИТУРА ДЕЙСТВИЙ">
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                    {ACTS.map(act => (
                        <button 
                            key={act} 
                            disabled={act.startsWith("---")} 
                            onClick={() => toggleSelection(config.selectedActs, act, 'selectedActs')} 
                            className={`p-4 text-[11px] text-left border-2 rounded-xl transition-all font-black uppercase tracking-tighter
                                ${act.startsWith("---") 
                                    ? 'col-span-full border-none text-latex-red pt-8 pb-2 opacity-100 text-sm' 
                                    : config.selectedActs.includes(act) 
                                        ? 'border-latex-red bg-latex-red/20 text-white shadow-neon scale-[1.02] z-10' 
                                        : 'border-gray-900 text-gray-600 hover:border-gray-700'}`}
                        >
                            {act.startsWith("---") ? act.replace(/---/g, '') : act}
                        </button>
                    ))}
                </div>
            </LatexCard>

            <LatexCard title="03 // СЮЖЕТ И ПОЖЕЛАНИЯ">
                <div className="space-y-6">
                    <div className="relative">
                        <select 
                            value={config.relationship} 
                            onChange={e => setConfig({...config, relationship: e.target.value})} 
                            className="w-full bg-black border-2 border-gray-900 p-5 text-sm text-white rounded-xl outline-none focus:border-latex-red appearance-none cursor-pointer font-black uppercase tracking-widest"
                        >
                            {RELATIONSHIPS.map(r => <option key={r} value={r} className="bg-black">{r}</option>)}
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-latex-red">▼</div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {TONES.map(t => (
                            <button 
                                key={t} 
                                onClick={() => setConfig({...config, tone: t})} 
                                className={`p-4 text-[10px] uppercase border-2 rounded-xl font-black transition-all
                                    ${config.tone === t ? 'border-latex-red bg-latex-red text-white shadow-neon' : 'border-gray-900 text-gray-600 hover:border-gray-700'}`}
                            >
                                {t}
                            </button>
                        ))}
                    </div>

                    <textarea 
                        value={config.customWords} 
                        onChange={e => setConfig({...config, customWords: e.target.value})} 
                        placeholder="ВАШИ ИДЕИ, СТОП-СЛОВА ИЛИ СЦЕНАРНЫЕ ПОВОРОТЫ..." 
                        className="w-full bg-black border-2 border-gray-900 p-6 text-sm text-white rounded-2xl h-48 outline-none focus:border-latex-red uppercase leading-relaxed resize-none font-bold tracking-wide" 
                    />
                </div>
            </LatexCard>

            <LatexCard title="04 // ГОЛОС ВЕДУЩЕГО">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="col-span-full flex bg-gray-950 rounded-xl p-1.5 border border-gray-900 mb-2">
                        {(['Male', 'Female'] as Gender[]).map(g => (
                            <button key={g} onClick={() => setConfig({...config, speakerGender: g})} className={`flex-1 py-3 text-xs uppercase font-black rounded-lg transition-all ${config.speakerGender === g ? 'bg-white text-black' : 'text-gray-600'}`}>
                                {g === 'Male' ? 'МУЖСКОЙ' : 'ЖЕНСКИЙ'}
                            </button>
                        ))}
                    </div>
                    {VOICES[config.speakerGender].map(v => (
                        <button 
                            key={v.id} 
                            onClick={() => setConfig({...config, selectedVoice: v.id})} 
                            className={`flex flex-col text-left p-5 border-2 rounded-2xl transition-all
                                ${config.selectedVoice === v.id ? 'border-latex-red bg-latex-red/10 text-white shadow-neon scale-[1.02]' : 'border-gray-900 text-gray-600 hover:border-gray-800'}`}
                        >
                            <p className="text-lg font-black uppercase tracking-widest">{v.label}</p>
                            <p className="text-[10px] opacity-50 font-bold mt-1">{v.desc}</p>
                        </button>
                    ))}
                </div>
            </LatexCard>

            <NeonButton onClick={handleGeneratePart1} className="w-full py-10 text-3xl shadow-[0_0_50px_rgba(138,0,0,0.5)] border-4">
                НАЧАТЬ СЕАНС
            </NeonButton>
          </>
        )}

        {result.part1 && (
            <div className="space-y-12 animate-slide-up pb-32">
                {result.part1.phases.map((p, i) => <ScenarioPhaseCard key={i} phase={p} index={i} />)}
                
                {error && (
                    <div className="p-6 border-2 border-latex-red bg-latex-red/10 text-latex-brightRed rounded-2xl shadow-neon">
                        <p className="text-xs font-black uppercase tracking-widest mb-4">Ошибка системы</p>
                        <p className="text-[10px] mb-4">{error}</p>
                        <NeonButton onClick={() => setError(null)} className="py-2 px-6 text-[10px]">ЗАКРЫТЬ</NeonButton>
                    </div>
                )}

                <div className="sticky bottom-8 z-40 bg-latex-black/95 border-2 border-latex-red/40 p-6 rounded-[2.5rem] shadow-neon backdrop-blur-2xl">
                    {!result.part1.audioBuffer ? (
                        generatingAudio ? (
                            <div className="py-6 space-y-4">
                                <div className="flex justify-between items-end mb-1">
                                    <span className="text-[10px] text-latex-red font-black uppercase tracking-widest animate-pulse">СИНТЕЗ...</span>
                                    <span className="text-[14px] text-white font-black">{audioProgress}%</span>
                                </div>
                                <div className="w-full h-3 bg-black border border-gray-800 rounded-full overflow-hidden shadow-inner">
                                    <div className="h-full bg-latex-red transition-all duration-300" style={{ width: `${audioProgress}%` }}></div>
                                </div>
                            </div>
                        ) : (
                            <NeonButton onClick={() => handleVoicePart(1)} className="w-full py-6 text-xl">ОЗВУЧИТЬ АКТ 1</NeonButton>
                        )
                    ) : (
                        <div className="space-y-6">
                            <AudioPlayer audioBuffer={result.part1.audioBuffer} label="ЧАСТЬ 1: ПОГРУЖЕНИЕ" />
                            {step === Step.RESULT_PART1 && (
                                <NeonButton onClick={handleGeneratePart2} variant="secondary" className="w-full py-4 text-xs font-black">СФОРМИРОВАТЬ ФИНАЛ</NeonButton>
                            )}
                        </div>
                    )}
                </div>

                {result.part2 && (
                    <div className="pt-24 border-t-4 border-latex-red/20 space-y-12">
                        <h2 className="text-center text-5xl font-black text-latex-red uppercase tracking-[0.8em] mb-20 drop-shadow-neon">КУЛЬМИНАЦИЯ</h2>
                        {result.part2.phases.map((p, i) => <ScenarioPhaseCard key={i} phase={p} index={i + 3} />)}
                        
                        <div className="sticky bottom-8 z-40 bg-latex-black/95 border-2 border-latex-red/40 p-6 rounded-[2.5rem] shadow-neon">
                            {!result.part2.audioBuffer ? (
                                generatingAudio ? (
                                    <div className="py-6 space-y-4">
                                        <div className="flex justify-between items-end mb-1">
                                            <span className="text-[10px] text-latex-red font-black uppercase tracking-widest animate-pulse">СИНТЕЗ ФИНАЛА...</span>
                                            <span className="text-[14px] text-white font-black">{audioProgress}%</span>
                                        </div>
                                        <div className="w-full h-3 bg-black border border-gray-800 rounded-full overflow-hidden shadow-inner">
                                            <div className="h-full bg-latex-red transition-all duration-300" style={{ width: `${audioProgress}%` }}></div>
                                        </div>
                                    </div>
                                ) : (
                                    <NeonButton onClick={() => handleVoicePart(2)} className="w-full py-6 text-xl">ОЗВУЧИТЬ АКТ 2</NeonButton>
                                )
                            ) : <AudioPlayer audioBuffer={result.part2.audioBuffer} label="ЧАСТЬ 2: КУЛЬМИНАЦИЯ" />}
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