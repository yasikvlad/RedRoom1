import React, { useEffect, useRef, useState } from 'react';
import { NeonButton } from './NeonButton';
import { audioBufferToWav } from '../services/geminiService';

interface AudioPlayerProps {
  audioBuffer: AudioBuffer;
  label?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ audioBuffer, label }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const startTimeRef = useRef<number>(0); // When the *current* play session started relative to AudioContext time
  const startOffsetRef = useRef<number>(0); // Where in the audio buffer we started playing from
  const rafRef = useRef<number | null>(null);

  const duration = audioBuffer.duration;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudio();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (downloadUrl) {
          URL.revokeObjectURL(downloadUrl);
      }
    };
  }, []);

  // Update loop for progress
  useEffect(() => {
    const animate = () => {
      if (audioContextRef.current && isPlaying) {
        const now = audioContextRef.current.currentTime;
        // Current play position = where we started in buffer + time elapsed since play click
        const actualTime = startOffsetRef.current + (now - startTimeRef.current);

        if (actualTime >= duration) {
          setIsPlaying(false);
          setCurrentTime(duration);
          stopAudio();
          startOffsetRef.current = 0; // Reset for next play
        } else {
          setCurrentTime(actualTime);
          rafRef.current = requestAnimationFrame(animate);
        }
      }
    };

    if (isPlaying) {
      rafRef.current = requestAnimationFrame(animate);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, duration]);

  const initContext = () => {
     if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  const play = () => {
    initContext();
    if (!audioContextRef.current) return;

    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    if (isPlaying) return;

    const source = audioContextRef.current.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContextRef.current.destination);
    
    // Check if we are at the end
    if (currentTime >= duration - 0.1) {
        startOffsetRef.current = 0;
        setCurrentTime(0);
    } else {
        startOffsetRef.current = currentTime;
    }

    source.start(0, startOffsetRef.current);
    
    startTimeRef.current = audioContextRef.current.currentTime;
    sourceNodeRef.current = source;
    setIsPlaying(true);
  };

  const pause = () => {
    if (sourceNodeRef.current && audioContextRef.current) {
      // Calculate where we stopped
      const now = audioContextRef.current.currentTime;
      const actualTime = startOffsetRef.current + (now - startTimeRef.current);
      setCurrentTime(actualTime);
      startOffsetRef.current = actualTime;
      
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
      setIsPlaying(false);
    }
  };

  const stopAudio = () => {
      if (sourceNodeRef.current) {
          try { sourceNodeRef.current.stop(); } catch (e) {}
          sourceNodeRef.current = null;
      }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTime = parseFloat(e.target.value);
      setCurrentTime(newTime);
      startOffsetRef.current = newTime;

      // If playing, we need to restart the node at the new time
      if (isPlaying && audioContextRef.current) {
          stopAudio();
          
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          
          source.start(0, newTime);
          
          startTimeRef.current = audioContextRef.current.currentTime;
          sourceNodeRef.current = source;
      }
  };

  const handleDownload = () => {
      if (!downloadUrl) {
          const blob = audioBufferToWav(audioBuffer);
          const url = URL.createObjectURL(blob);
          setDownloadUrl(url);
          
          // Trigger download manually
          const a = document.createElement('a');
          a.href = url;
          a.download = `redroom_session_${Date.now()}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      } else {
          // Re-trigger
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = `redroom_session_${Date.now()}.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
      }
  };

  const formatTime = (time: number) => {
      const minutes = Math.floor(time / 60);
      const seconds = Math.floor(time % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-4 p-5 bg-latex-shine/30 rounded-xl border border-latex-shine backdrop-blur-sm w-full shadow-inner-glow">
      {label && <div className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</div>}
      
      {/* Progress / Seek Bar */}
      <div className="space-y-2 w-full">
          <input 
            type="range"
            min="0"
            max={duration}
            step="0.1"
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-black rounded-lg appearance-none cursor-pointer border border-gray-700
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                [&::-webkit-slider-thumb]:bg-latex-red [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,0,0,0.8)]
                [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-125
                focus:outline-none"
             style={{
                 background: `linear-gradient(to right, #8a0000 0%, #ff0000 ${(currentTime/duration)*100}%, #000000 ${(currentTime/duration)*100}%, #000000 100%)`
             }}
          />
          <div className="flex justify-between text-xs font-mono text-gray-400 tracking-wider">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
          </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 justify-center items-center">
        <NeonButton onClick={isPlaying ? pause : play} className="flex-1 flex justify-center items-center py-2">
            {isPlaying ? (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="ml-2 text-sm">Пауза</span>
                </>
            ) : (
                <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="ml-2 text-sm">Играть</span>
                </>
            )}
        </NeonButton>
        
        <NeonButton onClick={handleDownload} variant="secondary" className="w-12 h-[42px] flex justify-center items-center px-0">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
             </svg>
        </NeonButton>
      </div>
    </div>
  );
};