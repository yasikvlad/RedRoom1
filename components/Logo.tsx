import React from 'react';

interface LogoProps {
  className?: string;
  size?: number;
}

export const Logo: React.FC<LogoProps> = ({ className = "", size = 80 }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Внешнее свечение логотипа */}
      <div className="absolute inset-0 bg-latex-red/20 blur-2xl rounded-full animate-pulse-slow"></div>
      
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 100 100" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="relative z-10 drop-shadow-[0_0_15px_rgba(138,0,0,0.8)]"
      >
        {/* Внешний круг */}
        <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1" className="text-latex-shine opacity-30" />
        
        {/* Основная фигура логотипа (стилизованная интерпретация по картинке) */}
        <g className="text-white fill-current">
          <path d="M50 10C27.9086 10 10 27.9086 10 50C10 72.0914 27.9086 90 50 90C72.0914 90 90 72.0914 90 50C90 27.9086 72.0914 10 50 10ZM50 82C32.3269 82 18 67.6731 18 50C18 32.3269 32.3269 18 50 18C67.6731 18 82 32.3269 82 50C82 67.6731 67.6731 82 50 82Z" opacity="0.2"/>
          
          <path d="M50 25C40 25 32 32 28 40C25 46 25 54 28 60C32 68 40 75 50 75C60 75 68 68 72 60C75 54 75 46 72 40C68 32 60 25 50 25ZM50 65C41.7157 65 35 58.2843 35 50C35 41.7157 41.7157 35 50 35C58.2843 35 65 41.7157 65 50C65 58.2843 58.2843 65 50 65Z" fill="currentColor" className="text-gray-400" />
          
          {/* Внутренние "лепестки" как на картинке */}
          <path d="M50 35C45 35 40 38 38 42C36 46 36 50 38 54C35 50 35 45 38 40C41 35 46 33 50 33V35Z" fill="white" />
          <path d="M50 65C55 65 60 62 62 58C64 54 64 50 62 46C65 50 65 55 62 60C59 65 54 67 50 67V65Z" fill="white" />
        </g>
      </svg>
      
      {/* Декоративное кольцо вращения */}
      <div 
        className="absolute border border-latex-red/40 rounded-full animate-[spin_10s_linear_infinite]"
        style={{ width: size + 20, height: size + 20 }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-latex-red rounded-full shadow-[0_0_10px_#ff0000]"></div>
      </div>
    </div>
  );
};