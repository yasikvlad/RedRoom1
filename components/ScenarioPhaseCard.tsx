import React from 'react';
import { ScenarioPhase } from '../types';

interface Props {
  phase: ScenarioPhase;
  index: number;
}

export const ScenarioPhaseCard: React.FC<Props> = ({ phase, index }) => {
  const number = (index + 1).toString().padStart(2, '0');
  
  return (
    <div className="bg-[#080808] border border-[#2a2a2a] rounded-xl p-6 md:p-8 font-mono text-gray-300 relative overflow-hidden mb-8 shadow-2xl">
       {/* Header */}
       <div className="flex items-baseline gap-4 mb-8 border-b border-[#2a2a2a] pb-6">
          <span className="text-6xl font-black text-[#151515] select-none">{number}</span>
          <div className="flex flex-col">
            <h3 className="text-xl md:text-2xl font-bold text-white uppercase tracking-tight">{phase.title}</h3>
            <span className="text-latex-red font-bold text-sm tracking-widest uppercase mt-1">{phase.duration}</span>
          </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-16">
          {/* Left Column */}
          <div className="space-y-8">
             <div>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Поза</h4>
                <p className="text-gray-200 leading-relaxed border-l-2 border-gray-700 pl-4 italic">{phase.pose}</p>
             </div>
             <div>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Инвентарь</h4>
                <p className="text-white font-bold">{phase.inventory}</p>
             </div>
             <div>
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Действие</h4>
                <p className="text-gray-300 leading-relaxed text-sm">{phase.action}</p>
             </div>
          </div>

          {/* Right Column */}
          <div className="space-y-8 flex flex-col h-full">
             <div className="border border-[#2a2a2a] bg-[#0c0c0c] p-6 rounded-lg relative shadow-inner-glow">
                <h4 className="text-[10px] font-bold text-latex-red uppercase tracking-[0.2em] mb-4">Dirty Talk</h4>
                <p className="text-gray-100 italic font-serif text-lg leading-relaxed tracking-wide">
                    "{phase.dirtyTalk}"
                </p>
             </div>
             
             <div className="mt-auto">
                <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mb-3">Сенсорика & SFX</h4>
                <p className="text-xs text-gray-400 leading-relaxed font-mono opacity-80">{phase.sensorics}</p>
             </div>
          </div>
       </div>
    </div>
  );
};