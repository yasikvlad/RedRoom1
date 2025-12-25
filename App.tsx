import React, { useState, useRef, useEffect } from 'react';
import { AppState, Step, Gender, GeneratedResult } from './types';
import { ACTS, ACCESSORIES, TONES } from './constants';
import { LatexCard } from './components/LatexCard';
import { NeonButton } from './components/NeonButton';
import { AudioPlayer } from './components/AudioPlayer';
import { generateScenarioContent, generateSpeech } from './services/geminiService';

const App: React.FC = () => {
  const [step, setStep] = useState<Step>(Step.CONFIG);
  const [config, setConfig] = useState<AppState>({
    targetGender: 'Male',
    targetName: '',
    selectedActs: [],
    selectedAccessories: [],
    customAccessories: '',
    tone: TONES[0],
    imageSize: '1K',
    customWords: '',
    allowProfanity: false,
    allowInsults: false,
  });
  const [result, setResult] = useState<GeneratedResult>({ part1: null, part2: null });
  const [error, setError] = useState<string | null>(null);
  const [loadingText, setLoadingText] = useState("");
  
  // Audio Generation State
  const [generatingAudio, setGeneratingAudio] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState(0);

  const toggleSelection = (list: string[], item: string, key: keyof AppState) => {
    // @ts-ignore
    const newList = list.includes(item) ? list.filter((i) => i !== item) : [...list, item];
    setConfig({ ...config, [key]: newList });
  };

  const getBasePrompt = (part: 1 | 2) => {
    const genderRu = config.targetGender === 'Male' ? 'Мужчины' : 'Девушки';
    const profanityInstruction = config.allowProfanity 
        ? "ИСПОЛЬЗУЙ МАТ (Блядь, сука, нахуй) для реализма и грубости." 
        : "Используй литературный, но возбуждающий язык. Без мата.";
    
    const insultInstruction = config.allowInsults
        ? "ДОБАВЬ УНИЖЕНИЯ и оскорбления. Называй шлюхой, грязным животным, ничтожеством."
        : "Будь уважителен, но доминантен (если выбран такой тон). Без оскорблений.";

    const customWordsInstruction = config.customWords
        ? `ОБЯЗАТЕЛЬНО используй следующие слова/фразы в диалоге: "${config.customWords}".`
        : "";

    return `
        Напиши **полный скрипт** для голосового аудио-гида (ASMR/Erotica) (Часть ${part} из 2).
        Длительность этой части: 15 минут.
        
        **Контекст:**
        - Партнер (слушатель): ${genderRu} по имени ${config.targetName}.
        - Тон голоса: ${config.tone}.
        - Действия: ${config.selectedActs.join(', ')}.
        - Аксессуары: ${config.selectedAccessories.join(', ')} ${config.customAccessories ? `, ${config.customAccessories}` : ''}.

        **Настройки лексики:**
        - ${profanityInstruction}
        - ${insultInstruction}
        - ${customWordsInstruction}

        **Инструкции по стилю (ВАЖНО ДЛЯ ОЗВУЧКИ):**
        - Текст должен быть только прямой речью. НЕ пиши слова автора.
        - Используй **многоточия (...)** для пауз.
        - Используй **CAPS LOCK** для крика/нажима.
        - Используй повторения ("Да... да...").
        - Включай дыхание и стоны (Ммм..., Оххх...).
        - МАКСИМАЛЬНЫЙ РЕАЛИЗМ. Голос должен запинаться от возбуждения, дышать в микрофон.

        ${part === 1 
            ? "**СТРУКТУРА ЧАСТИ 1 (0-15 мин):**\n1. Настройка, шепот (5 мин).\n2. Разогрев, использование реквизита (5 мин).\n3. Начало основного действия (5 мин)." 
            : "**СТРУКТУРА ЧАСТИ 2 (15-30 мин):**\n1. Продолжение действия, наращивание темпа (5 мин).\n2. ПИК/ОРГАЗМ (5 мин) - очень громко и интенсивно.\n3. AFTERCARE и выход (5 мин)."}

        Язык: Русский.
      `;
  }

  const handleGeneratePart1 = async () => {
    if (!config.targetName) { setError("Введите имя."); return; }
    if (config.selectedActs.length === 0) { setError("Выберите действия."); return; }

    setStep(Step.GENERATING_PART1);
    setError(null);
    setLoadingText("Генерация Части 1 (Начало)...");

    try {
      const prompt = getBasePrompt(1);
      const content = await generateScenarioContent(prompt, 1);
      
      setResult(prev => ({ ...prev, part1: { text: content.text, audioBuffer: null } }));
      
      // Auto-start audio generation for Part 1
      await generateAudioForPart(content.text, 1);
      setStep(Step.RESULT_PART1);
    } catch (e: any) {
      setError(e.message);
      setStep(Step.CONFIG);
    }
  };

  const handleGeneratePart2 = async () => {
    setStep(Step.GENERATING_PART2);
    setError(null);
    setLoadingText("Генерация Части 2 (Кульминация)...");

    try {
        const prompt = getBasePrompt(2);
        // Include context from part 1 implicitly via the prompt instructions
        const content = await generateScenarioContent(prompt, 2);

        setResult(prev => ({ ...prev, part2: { text: content.text, audioBuffer: null } }));
        
        await generateAudioForPart(content.text, 2);
        setStep(Step.RESULT_FULL);
    } catch(e: any) {
        setError(e.message);
        setStep(Step.RESULT_PART1); // Go back to part 1 view on failure
    }
  }

  const generateAudioForPart = async (text: string, partNum: 1 | 2) => {
    setGeneratingAudio(true);
    setAudioProgress(0);
    
    // Estimate: Part 1/2 are roughly 15 mins content, maybe 2000-3000 chars.
    const charCount = text.length;
    const estimatedSeconds = Math.max(10, Math.ceil(charCount / 40)); 
    setEstimatedTimeRemaining(estimatedSeconds);

    const startTime = Date.now();
    
    const progressInterval = setInterval(() => {
        setAudioProgress(prev => {
            if (prev >= 98) return 98;
            const elapsed = (Date.now() - startTime) / 1000;
            const percentage = Math.min(98, (elapsed / estimatedSeconds) * 100);
            const remaining = Math.max(0, estimatedSeconds - elapsed);
            setEstimatedTimeRemaining(Math.ceil(remaining));
            return percentage;
        });
    }, 200);

    try {
      // Logic: If target is Male, voice is Female. If target is Female, voice is Male.
      const voiceGender = config.targetGender === 'Male' ? 'Female' : 'Male';
      const audioBuffer = await generateSpeech(text, voiceGender);
      
      setResult(prev => {
          if (partNum === 1) return { ...prev, part1: { ...prev.part1!, audioBuffer } };
          return { ...prev, part2: { ...prev.part2!, audioBuffer } };
      });
      setAudioProgress(100);
    } catch (e: any) {
      setError("Ошибка синтеза речи: " + e.message);
    } finally {
      clearInterval(progressInterval);
      setGeneratingAudio(false);
    }
  };

  const reset = () => {
    setStep(Step.CONFIG);
    setResult({ part1: null, part2: null });
    setError(null);
    setAudioProgress(0);
  };

  const renderLoader = () => (
    <div className="min-h-screen bg-latex-black flex flex-col items-center justify-center p-4">
        <div className="w-20 h-20 relative">
            <div className="absolute inset-0 border-4 border-latex-red/30 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-latex-red border-t-transparent rounded-full animate-spin"></div>
        </div>
        <h2 className="text-2xl font-bold text-latex-red animate-pulse-slow text-center mt-8 tracking-widest uppercase">{loadingText}</h2>
        
        {generatingAudio && (
             <div className="mt-6 w-64">
                <div className="flex justify-between text-xs text-latex-red font-mono mb-1">
                    <span>Синтез аудио...</span>
                    <span>{Math.round(audioProgress)}%</span>
                </div>
                <div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
                   <div className="h-full bg-latex-red transition-all duration-300" style={{ width: `${audioProgress}%` }}></div>
                </div>
                <p className="text-center text-gray-600 text-xs mt-2 font-mono">Осталось: ~{estimatedTimeRemaining} сек.</p>
             </div>
        )}
      </div>
  );

  if (step === Step.GENERATING_PART1 || step === Step.GENERATING_PART2) {
      return renderLoader();
  }

  return (
    <div className="min-h-screen bg-latex-black text-gray-200 selection:bg-latex-red selection:text-white pb-24">
      <header className="fixed top-0 w-full z-50 bg-latex-black/90 backdrop-blur-md border-b border-latex-red/20 shadow-neon">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-latex-red to-red-500 drop-shadow-[0_0_10px_rgba(255,0,0,0.5)]">
            REDROOM<span className="text-xs align-top opacity-70">GIT</span>
          </h1>
          {(step === Step.RESULT_PART1 || step === Step.RESULT_FULL) && (
             <button onClick={reset} className="text-xs uppercase tracking-widest text-gray-500 hover:text-white transition-colors border border-transparent hover:border-latex-red px-2 py-1 rounded">
               Новый Сеанс
             </button>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto pt-24 px-4">
        {step === Step.CONFIG && (
          <div className="space-y-8 animate-fade-in">
             <div className="text-center space-y-2 mb-10">
                <p className="text-red-500 uppercase tracking-[0.2em] text-sm font-bold">Конфигурация Сессии</p>
                <h2 className="text-4xl font-bold text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">Параметры Сеанса</h2>
             </div>

             {/* 1. Target */}
             <LatexCard title="01 // Субъект">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Для кого сценарий</label>
                    <div className="flex bg-black rounded-lg p-1 border border-gray-800">
                        {(['Male', 'Female'] as Gender[]).map(g => (
                            <button
                                key={g}
                                onClick={() => setConfig({...config, targetGender: g})}
                                className={`flex-1 py-2 rounded-md transition-all font-bold uppercase ${config.targetGender === g ? 'bg-latex-red text-white shadow-[0_0_15px_rgba(255,0,0,0.4)]' : 'text-gray-500 hover:text-gray-300'}`}
                            >
                                {g === 'Male' ? 'Мужчина' : 'Девушка'}
                            </button>
                        ))}
                    </div>
                 </div>
                 <div>
                    <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Имя Партнера</label>
                    <input 
                        type="text" 
                        value={config.targetName}
                        onChange={(e) => setConfig({...config, targetName: e.target.value})}
                        placeholder="напр., Влад"
                        className="w-full bg-black border border-gray-800 text-white p-2 rounded-lg focus:border-latex-red focus:outline-none focus:shadow-[0_0_10px_rgba(138,0,0,0.5)] transition-all placeholder-gray-700"
                    />
                 </div>
               </div>
             </LatexCard>

             {/* 2. Acts */}
             <LatexCard title="02 // Протоколы (Действия)">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {ACTS.map(act => (
                        <button
                            key={act}
                            onClick={() => toggleSelection(config.selectedActs, act, 'selectedActs')}
                            className={`p-3 text-xs md:text-sm text-left rounded border transition-all duration-200 ${
                                config.selectedActs.includes(act) 
                                ? 'border-latex-red bg-latex-red/10 text-white shadow-[inset_0_0_10px_rgba(255,0,0,0.2)]' 
                                : 'border-gray-800 bg-black/50 text-gray-500 hover:border-gray-600'
                            }`}
                        >
                            {config.selectedActs.includes(act) ? '⦿' : '○'} {act}
                        </button>
                    ))}
                </div>
             </LatexCard>

             {/* 3. Accessories */}
             <LatexCard title="03 // Инструментарий">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                    {ACCESSORIES.map(item => (
                        <button
                            key={item}
                            onClick={() => toggleSelection(config.selectedAccessories, item, 'selectedAccessories')}
                            className={`p-3 text-xs md:text-sm text-left rounded border transition-all duration-200 ${
                                config.selectedAccessories.includes(item) 
                                ? 'border-latex-red bg-latex-red/10 text-white shadow-[inset_0_0_10px_rgba(255,0,0,0.2)]' 
                                : 'border-gray-800 bg-black/50 text-gray-500 hover:border-gray-600'
                            }`}
                        >
                           {config.selectedAccessories.includes(item) ? '✓' : '+'} {item}
                        </button>
                    ))}
                </div>
                <div>
                    <input 
                        type="text" 
                        value={config.customAccessories}
                        onChange={(e) => setConfig({...config, customAccessories: e.target.value})}
                        placeholder="Свои игрушки / предметы..."
                        className="w-full bg-black border border-gray-800 text-white p-3 rounded-lg focus:border-latex-red focus:outline-none placeholder-gray-700"
                    />
                </div>
             </LatexCard>

             {/* 4. Details */}
             <LatexCard title="04 // Детализация и Лексика">
                 <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {TONES.map(tone => (
                            <button
                                key={tone}
                                onClick={() => setConfig({...config, tone})}
                                className={`p-3 text-xs md:text-sm text-center font-bold uppercase tracking-wide rounded border transition-all duration-200 ${
                                    config.tone === tone
                                    ? 'border-latex-red bg-latex-red text-white shadow-neon' 
                                    : 'border-gray-800 bg-black/50 text-gray-500 hover:bg-gray-900'
                                }`}
                            >
                            {tone}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-800 pt-4">
                        <label className="flex items-center space-x-3 cursor-pointer group">
                            <div className={`w-6 h-6 border rounded flex items-center justify-center transition-colors ${config.allowProfanity ? 'bg-latex-red border-latex-red' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                {config.allowProfanity && <span className="text-white text-xs">✓</span>}
                            </div>
                            <input type="checkbox" className="hidden" checked={config.allowProfanity} onChange={e => setConfig({...config, allowProfanity: e.target.checked})} />
                            <span className={`uppercase text-xs tracking-wider ${config.allowProfanity ? 'text-white' : 'text-gray-500'}`}>Разрешить Мат</span>
                        </label>

                        <label className="flex items-center space-x-3 cursor-pointer group">
                            <div className={`w-6 h-6 border rounded flex items-center justify-center transition-colors ${config.allowInsults ? 'bg-latex-red border-latex-red' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                {config.allowInsults && <span className="text-white text-xs">✓</span>}
                            </div>
                            <input type="checkbox" className="hidden" checked={config.allowInsults} onChange={e => setConfig({...config, allowInsults: e.target.checked})} />
                            <span className={`uppercase text-xs tracking-wider ${config.allowInsults ? 'text-white' : 'text-gray-500'}`}>Унижение / Оскорбления</span>
                        </label>
                    </div>

                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-2">Обязательные слова (через запятую)</label>
                        <input 
                            type="text" 
                            value={config.customWords}
                            onChange={(e) => setConfig({...config, customWords: e.target.value})}
                            placeholder="напр., киска, хозяин, дырочка..."
                            className="w-full bg-black border border-gray-800 text-white p-3 rounded-lg focus:border-latex-red focus:outline-none placeholder-gray-700"
                        />
                    </div>
                 </div>
             </LatexCard>

             {error && (
                 <div className="p-4 border border-red-500 bg-red-900/20 text-red-500 text-center rounded animate-pulse">
                     {error}
                 </div>
             )}
             
             <div className="sticky bottom-6 z-40">
                <NeonButton onClick={handleGeneratePart1} className="w-full text-xl py-6 shadow-neon" disabled={!config.targetName}>
                    Начать Сеанс (Часть 1)
                </NeonButton>
             </div>
          </div>
        )}

        {(step === Step.RESULT_PART1 || step === Step.RESULT_FULL) && result.part1 && (
            <div className="space-y-8 animate-slide-up pb-20">
                {/* Part 1 */}
                <LatexCard title="ЧАСТЬ 1: НАЧАЛО (15 МИН)">
                    {result.part1.audioBuffer ? (
                        <AudioPlayer audioBuffer={result.part1.audioBuffer} label="Audio Guide Part 1" />
                    ) : (
                        <div className="text-red-500">Ошибка загрузки аудио части 1.</div>
                    )}
                    <div className="mt-4 p-4 bg-black/50 rounded text-gray-400 text-sm max-h-40 overflow-y-auto font-serif leading-relaxed border border-gray-800">
                        {result.part1.text}
                    </div>
                </LatexCard>

                {/* Part 2 Section */}
                {step === Step.RESULT_PART1 && (
                    <div className="text-center py-8">
                        <p className="text-gray-400 mb-6 text-sm max-w-md mx-auto">
                            Первая часть завершена. Вы можете скачать её и прослушать. 
                            Готовы продолжить к кульминации?
                        </p>
                        <NeonButton onClick={handleGeneratePart2} className="w-full md:w-auto px-12 py-4 text-lg animate-pulse-slow">
                            Сгенерировать Часть 2 (Финал)
                        </NeonButton>
                    </div>
                )}

                {/* Part 2 Result */}
                {step === Step.RESULT_FULL && result.part2 && (
                    <LatexCard title="ЧАСТЬ 2: КУЛЬМИНАЦИЯ (15 МИН)">
                        {result.part2.audioBuffer ? (
                             <AudioPlayer audioBuffer={result.part2.audioBuffer} label="Audio Guide Part 2" />
                        ) : (
                             <div className="text-red-500">Ошибка загрузки аудио части 2.</div>
                        )}
                        <div className="mt-4 p-4 bg-black/50 rounded text-gray-400 text-sm max-h-40 overflow-y-auto font-serif leading-relaxed border border-gray-800">
                            {result.part2.text}
                        </div>
                    </LatexCard>
                )}
            </div>
        )}
      </main>
    </div>
  );
};

export default App;