import React, { useState, useEffect } from 'react';
import { LiveTutor } from './Components/LiveTutor';
import { TTSDrill } from './Components/TTSDrill';
import { QuickHelp } from './Components/QuickHelp';
import { ReadingPractice } from './Components/ReadingPractice';
import { VocabularyBuilder } from './Components/VocabularyBuilder';
import { UserProgressCard } from './Components/UserProgressCard';
import { AppMode } from './types';
import { POINTS } from './hooks/useProgress';

function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [isDark, setIsDark] = useState(true);

  // Toggle Theme Effect
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark(!isDark);

  const renderContent = () => {
    switch (mode) {
      case AppMode.LIVE_TUTOR:
        return <LiveTutor />;
      case AppMode.READING:
        return <ReadingPractice />;
      case AppMode.DRILLS:
        return (
          <div className="h-full overflow-y-auto pb-24 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
            <header className="p-6">
               <h2 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-400 dark:to-brand-200">
                 Tools & Practice
               </h2>
               <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Mejora tu inglés a tu ritmo.</p>
            </header>
            <TTSDrill />
            <VocabularyBuilder />
            <QuickHelp />
          </div>
        );
      case AppMode.HOME:
      default:
        return (
          <div className="h-full flex flex-col items-center justify-center p-6 space-y-6 bg-slate-50 dark:bg-slate-900 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-100 via-slate-50 to-slate-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 overflow-y-auto transition-colors duration-300">
             
             <div className="flex flex-col items-center mt-4 mb-2">
                <div className="relative w-40 h-40 flex items-center justify-center mb-6 group">
                    <div className="absolute inset-0 bg-brand-500/30 blur-3xl rounded-full opacity-0 dark:opacity-100 transition-opacity duration-500"></div>
                    
                    <div className="relative w-full h-full bg-white rounded-full shadow-2xl flex items-center justify-center p-4 ring-4 ring-slate-50 dark:ring-slate-800 transition-transform duration-500 hover:scale-105">
                        <svg viewBox="0 0 200 200" className="w-full h-full" fill="none" xmlns="http://www.w3.org/2000/svg">
                             <circle cx="100" cy="100" r="90" stroke="#08843f" strokeWidth="12" />
                             <text 
                                x="100" 
                                y="130" 
                                textAnchor="middle" 
                                fontSize="80" 
                                fontWeight="900" 
                                fill="#08843f" 
                                fontFamily="Nunito, sans-serif"
                             >
                                 ES
                             </text>
                        </svg>
                    </div>
                </div>

                <div className="text-center mb-4">
                   <h1 className="text-3xl font-black tracking-tighter text-slate-900 dark:text-white">ENGLISH START</h1>
                   <p className="text-xs font-bold tracking-[0.3em] text-brand-600 dark:text-brand-400 uppercase mt-1">Tu Tutor Personal con IA</p>
                </div>

                {/* Gamification Card */}
                <UserProgressCard />
             </div>

             <div className="w-full max-w-sm space-y-4">
                <button 
                  onClick={() => setMode(AppMode.LIVE_TUTOR)}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white p-4 rounded-2xl font-bold text-lg shadow-lg shadow-brand-500/20 flex items-center justify-center gap-3 transition-transform active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                  <div>
                    <span className="block">Clase en Vivo</span>
                    <span className="block text-[10px] opacity-70 font-normal uppercase tracking-wider">+{POINTS.live} XP Points</span>
                  </div>
                </button>
                
                <button 
                  onClick={() => setMode(AppMode.READING)}
                  className="w-full bg-slate-200 dark:bg-brand-800 hover:bg-slate-300 dark:hover:bg-brand-700 text-brand-900 dark:text-white p-4 rounded-2xl font-bold text-lg shadow-lg shadow-slate-900/10 dark:shadow-slate-900/20 flex items-center justify-center gap-3 transition-transform active:scale-95 border border-slate-300 dark:border-brand-700"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
                  <div>
                    <span className="block">Práctica de Lectura</span>
                    <span className="block text-[10px] opacity-70 font-normal uppercase tracking-wider">+{POINTS.reading} XP Points</span>
                  </div>
                </button>

                <button 
                  onClick={() => setMode(AppMode.DRILLS)}
                  className="w-full bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-700 dark:text-white border border-slate-200 dark:border-slate-600 p-4 rounded-2xl font-bold text-lg shadow-lg flex items-center justify-center gap-3 transition-transform active:scale-95"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  <div>
                    <span className="block">Frases y Vocabulario</span>
                    <span className="block text-[10px] opacity-70 font-normal uppercase tracking-wider">+{POINTS.vocab} XP Points</span>
                  </div>
                </button>
             </div>

             <div className="pt-6 text-center max-w-xs mx-auto opacity-70 hover:opacity-100 transition-opacity">
               <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                 AI Tutor Beta Version. Developed by Dr. Anderzon Medina Roa
               </p>
             </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white overflow-hidden flex flex-col font-sans transition-colors duration-300">
       
       <div className="absolute top-4 right-4 z-50">
          <button 
            onClick={toggleTheme}
            className="p-3 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-yellow-400 shadow-md transition-all hover:scale-110"
          >
            {isDark ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
       </div>

       {/* GLOBAL HEADER - Now Relative / Flex Child */}
       {mode !== AppMode.HOME && (
         <header className="flex-shrink-0 w-full z-40 p-4 flex justify-between items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 transition-colors duration-300">
            <button 
              onClick={() => setMode(AppMode.HOME)}
              className="bg-white dark:bg-slate-800 text-slate-700 dark:text-white p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 shadow-sm"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            </button>
            <div className="bg-brand-100 dark:bg-brand-900/50 px-3 py-1 rounded-full border border-brand-500/20 mr-12">
               <span className="text-xs font-bold text-brand-700 dark:text-brand-300 tracking-wider uppercase">
                  {mode === AppMode.LIVE_TUTOR ? 'Live Class' : mode === AppMode.READING ? 'Reading' : 'Tools'}
               </span>
            </div>
         </header>
       )}

       {/* MAIN CONTENT - Flex Fill */}
       <main className="flex-1 overflow-hidden relative flex flex-col">
         {renderContent()}
       </main>
    </div>
  );
}

export default App;

