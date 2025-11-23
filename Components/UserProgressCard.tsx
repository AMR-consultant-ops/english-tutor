import React from 'react';
import { useGlobalStats, LEVELS } from '../hooks/useProgress';

export const UserProgressCard: React.FC = () => {
  const { totalXp, level, nextLevelXp, progressPercent, stars } = useGlobalStats();

  const isBasicUser = level.title === 'Basic User';

  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-lg border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
             <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-3xl shadow-inner">
               {level.icon}
             </div>
             {/* Star Badge */}
             <div className="absolute -bottom-1 -right-1 flex gap-0.5 bg-white dark:bg-slate-800 px-1 py-0.5 rounded-full border border-slate-100 dark:border-slate-600 shadow-sm">
                {[1, 2, 3].map(i => (
                  <svg key={i} className={`w-3 h-3 ${i <= stars ? 'text-yellow-400 fill-current' : 'text-slate-300 dark:text-slate-600'}`} viewBox="0 0 20 20">
                     <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
             </div>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest">Current Level</p>
            <h3 className={`text-xl font-black ${level.color}`}>{level.title}</h3>
          </div>
        </div>
        <div className="text-right">
          <span className="text-3xl font-black text-slate-800 dark:text-white">{totalXp}</span>
          <span className="text-xs font-bold text-slate-400 dark:text-slate-500 ml-1">XP</span>
        </div>
      </div>

      <div className="relative pt-1">
        <div className="flex mb-2 items-center justify-between">
          <span className="text-xs font-semibold inline-block py-0.5 px-2 uppercase rounded text-brand-600 bg-brand-100 dark:text-brand-200 dark:bg-brand-900/50">
            {isBasicUser ? 'A1 Ready!' : 'Next Level'}
          </span>
          <div className="text-right">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
              {Math.floor(progressPercent)}%
            </span>
          </div>
        </div>
        <div className="overflow-hidden h-3 mb-1 text-xs flex rounded-full bg-slate-100 dark:bg-slate-700 shadow-inner relative">
           {/* Markers for Apprentice/Basic User */}
           <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/50 z-10"></div>
           <div
            style={{ width: `${progressPercent}%` }}
            className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center transition-all duration-1000 ease-out ${isBasicUser ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' : 'bg-gradient-to-r from-brand-400 to-brand-600'}`}
          ></div>
        </div>
        {/* Improved layout for labels to prevent overlap */}
        <div className="flex justify-between text-[8px] text-slate-400 font-bold uppercase mt-1">
           <span className="flex-1 text-left">Novice</span>
           <span className="flex-1 text-center">Apprentice ({LEVELS.APPRENTICE.min})</span>
           <span className="flex-1 text-right">Basic ({LEVELS.BASIC_USER.min})</span>
        </div>
      </div>
    </div>
  );
};
