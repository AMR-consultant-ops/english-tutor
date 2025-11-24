import React from 'react';
import { useGlobalStats, LEVELS } from '../hooks/useProgress';

export const UserProgressCard: React.FC = () => {
  const { totalXp, level, nextLevelXp, progressPercent, stars } = useGlobalStats();

  const isBasicUser = level.title === 'Basic User';
  
  // Determine next level name for display
  let nextLevelName = 'Basic User';
  if (level.title === 'Novice') nextLevelName = 'Apprentice';
  else if (level.title === 'Apprentice') nextLevelName = 'Basic User';
  else nextLevelName = 'Master';

  return (
    <div className="w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl p-6 shadow-xl border border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-4 duration-700 relative overflow-hidden group">
      
      {/* Decorative background glow */}
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all duration-500"></div>

      <div className="relative z-10 flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="relative">
             <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-4xl shadow-inner ring-1 ring-slate-200 dark:ring-slate-600">
               {level.icon}
             </div>
             {/* Star Badge */}
             <div className="absolute -bottom-2 -right-2 flex gap-0.5 bg-white dark:bg-slate-800 px-1.5 py-1 rounded-full border border-slate-100 dark:border-slate-600 shadow-sm">
                {[1, 2, 3].map(i => (
                  <svg key={i} className={`w-3 h-3 ${i <= stars ? 'text-yellow-400 fill-current' : 'text-slate-200 dark:text-slate-600'}`} viewBox="0 0 20 20">
                     <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
             </div>
          </div>
          <div>
            <p className="text-[10px] text-brand-600 dark:text-brand-400 font-extrabold uppercase tracking-widest mb-0.5">Current Level</p>
            <h3 className={`text-2xl font-black text-slate-900 dark:text-white`}>{level.title}</h3>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <div className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">{totalXp}</div>
          <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total XP</div>
        </div>
      </div>

      <div className="relative z-10 space-y-2">
        <div className="flex justify-between items-end text-xs">
           <span className="font-bold text-slate-500 dark:text-slate-400">
             Start
           </span>
           <span className="font-bold text-slate-900 dark:text-white">
             {isBasicUser ? 'Max Level' : `${nextLevelXp} XP Goal`}
           </span>
        </div>
        
        <div className="h-4 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden shadow-inner ring-1 ring-slate-200 dark:ring-slate-700/50">
           <div
            style={{ width: `${progressPercent}%` }}
            className={`h-full shadow-lg relative overflow-hidden transition-all duration-1000 ease-out ${
              isBasicUser 
              ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' 
              : 'bg-gradient-to-r from-brand-500 to-brand-400'
            }`}
          >
             <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
          </div>
        </div>

        <div className="flex justify-between items-center mt-1">
           <p className="text-[10px] text-slate-400 font-semibold">
             {Math.floor(progressPercent)}% to {nextLevelName}
           </p>
           {!isBasicUser && (
             <p className="text-[10px] text-brand-600 dark:text-brand-400 font-bold">
               Keep going!
             </p>
           )}
        </div>
      </div>
    </div>
  );
};
