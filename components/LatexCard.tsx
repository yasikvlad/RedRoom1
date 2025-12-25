import React from 'react';

interface LatexCardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export const LatexCard: React.FC<LatexCardProps> = ({ children, title, className = "" }) => {
  return (
    <div className={`relative group p-6 rounded-xl bg-latex-black border border-latex-shine shadow-inner-glow transition-all duration-300 hover:shadow-neon ${className}`}>
        {/* Shiny latex highlight effect */}
        <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-gray-600 to-transparent opacity-50"></div>
        
        {title && (
            <h3 className="text-xl font-bold mb-4 text-latex-red tracking-widest uppercase border-b border-latex-red/30 pb-2">
                {title}
            </h3>
        )}
        <div className="relative z-10">
            {children}
        </div>
    </div>
  );
};