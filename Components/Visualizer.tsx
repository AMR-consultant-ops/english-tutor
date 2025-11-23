import React from 'react';
import { AudioVisualizerState } from '../types';

interface VisualizerProps {
  state: AudioVisualizerState;
}

export const Visualizer: React.FC<VisualizerProps> = ({ state }) => {
  return (
    <div className="flex justify-center items-center h-24 space-x-1">
      {state === 'idle' && (
        <div className="w-4 h-4 rounded-full bg-slate-600 animate-pulse"></div>
      )}
      
      {state === 'listening' && (
        <>
          {/* Using standard style attributes for animation delays to ensure stability */}
          <div className="w-2 bg-brand-500 rounded-full h-8 animate-wave"></div>
          <div className="w-2 bg-brand-500 rounded-full h-12 animate-wave" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-2 bg-brand-500 rounded-full h-16 animate-wave" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 bg-brand-500 rounded-full h-10 animate-wave" style={{ animationDelay: '0.3s' }}></div>
          <div className="w-2 bg-brand-500 rounded-full h-6 animate-wave" style={{ animationDelay: '0.4s' }}></div>
        </>
      )}

      {state === 'speaking' && (
        <div className="relative w-20 h-20 flex items-center justify-center">
             <div className="absolute w-full h-full bg-brand-500 rounded-full opacity-20 animate-ping"></div>
             <div className="absolute w-16 h-16 bg-brand-500 rounded-full opacity-40 animate-pulse"></div>
             <svg className="w-8 h-8 text-white z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
             </svg>
        </div>
      )}
    </div>
  );
};