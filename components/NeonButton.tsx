import React from 'react';

interface NeonButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
}

export const NeonButton: React.FC<NeonButtonProps> = ({ children, variant = 'primary', className = "", ...props }) => {
  const baseClasses = "relative px-8 py-3 font-bold tracking-widest uppercase transition-all duration-300 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed rounded-md overflow-hidden group";
  
  const variants = {
    primary: "text-white bg-latex-red border border-red-600 hover:bg-red-700 hover:shadow-[0_0_20px_rgba(255,0,0,0.6)]",
    secondary: "text-gray-300 bg-latex-shine border border-gray-600 hover:bg-gray-700 hover:text-white",
    danger: "text-red-500 border border-red-900 hover:bg-red-900/20"
  };

  return (
    <button className={`${baseClasses} ${variants[variant]} ${className}`} {...props}>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      {/* Shine effect */}
      <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shine_1s_ease-in-out_infinite]" />
    </button>
  );
};