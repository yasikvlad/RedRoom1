import React from 'react';
import { Logo } from './Logo';

export const Hero: React.FC = () => {
  return (
    <div className="relative py-16 mb-12 overflow-hidden rounded-2xl border border-latex-shine bg-latex-black shadow-neon animate-fade-in group select-none">
       {/* Abstract Background Elements */}
       <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
          <div className="absolute top-[-50%] left-[-20%] w-[500px] h-[500px] bg-latex-red rounded-full blur-[120px] animate-pulse-slow"></div>
          <div className="absolute bottom-[-50%] right-[-20%] w-[500px] h-[500px] bg-latex-red rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: '1.5s' }}></div>
       </div>

       <div className="relative z-10 flex flex-col items-center text-center space-y-6 px-4">
           {/* New Logo Integration */}
           <Logo size={100} className="mb-4" />

           <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-700 drop-shadow-[0_10px_10px_rgba(0,0,0,0.8)]">
              REDROOM
           </h1>
           
           <div className="flex items-center justify-center gap-4 opacity-80">
              <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-latex-red"></div>
              <div className="h-2 w-2 bg-latex-red rotate-45 shadow-[0_0_10px_#ff0000]"></div>
              <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-latex-red"></div>
           </div>

           <p className="text-gray-400 uppercase tracking-[0.3em] text-xs md:text-sm font-bold max-w-2xl mx-auto leading-relaxed">
              Гипер-персонализированный <span className="text-latex-red animate-pulse">AI-Режиссер</span><br/> 
              для твоего самого глубокого опыта.
           </p>
       </div>
    </div>
  );
};