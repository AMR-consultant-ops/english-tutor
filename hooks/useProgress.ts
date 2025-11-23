import { useState, useEffect, useCallback } from 'react';

export type ProgressCategory = 'live' | 'reading' | 'vocab';

const STORAGE_KEY = 'english_start_progress_v1';

export const POINTS = {
  live: 15,
  reading: 10,
  vocab: 5
};

export const LEVELS = {
  NOVICE: { min: 0, title: 'Novice', icon: '🌱', color: 'text-green-500' },
  APPRENTICE: { min: 150, title: 'Apprentice', icon: '🚀', color: 'text-blue-500' },
  BASIC_USER: { min: 400, title: 'Basic User', icon: '🏅', color: 'text-yellow-500' }
};

interface ProgressState {
  live: string[];
  reading: string[];
  vocab: string[];
}

// Safe storage wrapper to prevent crashes in restricted environments
const storage = {
  get: (): ProgressState => {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
          return { live: [], reading: [], vocab: [] };
      }
      const item = localStorage.getItem(STORAGE_KEY);
      if (!item) return { live: [], reading: [], vocab: [] };
      
      try {
          const parsed = JSON.parse(item);
          // Critical fix: JSON.parse can return null, or non-object types. 
          // We must ensure we return a valid ProgressState object to prevent app crashes.
          if (!parsed || typeof parsed !== 'object') {
             return { live: [], reading: [], vocab: [] };
          }
          return {
             live: Array.isArray(parsed.live) ? parsed.live : [],
             reading: Array.isArray(parsed.reading) ? parsed.reading : [],
             vocab: Array.isArray(parsed.vocab) ? parsed.vocab : []
          };
      } catch {
          return { live: [], reading: [], vocab: [] };
      }
    } catch (e) {
      console.warn('LocalStorage access blocked:', e);
      return { live: [], reading: [], vocab: [] };
    }
  },
  set: (data: ProgressState) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          // Dispatch a custom event so other hooks can update
          window.dispatchEvent(new Event('progress-updated'));
      }
    } catch (e) {
      console.warn('LocalStorage write blocked:', e);
    }
  }
};

export const useProgress = (category: ProgressCategory) => {
  const [completedIds, setCompletedIds] = useState<string[]>([]);

  const load = useCallback(() => {
    const allProgress = storage.get();
    setCompletedIds(allProgress[category] || []);
  }, [category]);

  useEffect(() => {
    load();
    const handleUpdate = () => load();
    window.addEventListener('progress-updated', handleUpdate);
    return () => window.removeEventListener('progress-updated', handleUpdate);
  }, [load]);

  const toggleProgress = useCallback((id: string) => {
    setCompletedIds(prev => {
      const exists = prev.includes(id);
      // For toggling, we remove all instances if it exists, or add one if it doesn't
      const newIds = exists ? prev.filter(i => i !== id) : [...prev, id];
      
      const allProgress = storage.get();
      allProgress[category] = newIds;
      storage.set(allProgress);
      
      return newIds;
    });
  }, [category]);

  const markAsComplete = useCallback((id: string) => {
    setCompletedIds(prev => {
      // Allow duplicates to accumulate XP for repeated practice sessions
      const newIds = [...prev, id];
      
      const allProgress = storage.get();
      allProgress[category] = newIds;
      storage.set(allProgress);
      
      return newIds;
    });
  }, [category]);

  const isCompleted = useCallback((id: string) => completedIds.includes(id), [completedIds]);

  return { completedIds, toggleProgress, markAsComplete, isCompleted };
};

// Hook for Global Stats (Home Screen)
export const useGlobalStats = () => {
  const [stats, setStats] = useState({ 
    totalXp: 0, 
    level: LEVELS.NOVICE, 
    nextLevelXp: LEVELS.APPRENTICE.min,
    progressPercent: 0,
    stars: 0
  });

  const calculate = useCallback(() => {
    const data = storage.get();
    const xp = 
      (data.live?.length || 0) * POINTS.live +
      (data.reading?.length || 0) * POINTS.reading +
      (data.vocab?.length || 0) * POINTS.vocab;

    let currentLevel = LEVELS.NOVICE;
    let nextXp = LEVELS.APPRENTICE.min;
    let stars = 0;
    
    if (xp >= LEVELS.BASIC_USER.min) {
      currentLevel = LEVELS.BASIC_USER;
      nextXp = LEVELS.BASIC_USER.min; // Cap for visual bar
      stars = 3;
    } else if (xp >= LEVELS.APPRENTICE.min) {
      currentLevel = LEVELS.APPRENTICE;
      nextXp = LEVELS.BASIC_USER.min;
      stars = 2;
    } else {
      stars = 1;
    }

    const prevMin = currentLevel.min;
    const range = nextXp - prevMin;
    const currentProgress = xp - prevMin;
    
    let percent = 0;
    if (currentLevel.title === 'Basic User') {
        percent = 100;
    } else {
        const effectiveRange = range > 0 ? range : 1; 
        percent = Math.min(100, Math.max(0, (currentProgress / effectiveRange) * 100));
    }

    setStats({
      totalXp: xp,
      level: currentLevel,
      nextLevelXp: nextXp,
      progressPercent: percent,
      stars
    });
  }, []);

  useEffect(() => {
    calculate();
    const handleUpdate = () => calculate();
    window.addEventListener('progress-updated', handleUpdate);
    return () => window.removeEventListener('progress-updated', handleUpdate);
  }, [calculate]);

  return stats;
};