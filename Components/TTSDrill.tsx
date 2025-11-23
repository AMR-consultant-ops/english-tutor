import React, { useState, useEffect, useRef } from 'react';
import { playTTS } from '../utils/ttsUtils';

type Category = 'Survival' | 'Greetings' | 'Travel' | 'Social' | 'Feelings';

const DATA: Record<Category, { en: string; es: string }[]> = {
  Survival: [
    { en: "Yes", es: "Sí" },
    { en: "No", es: "No" },
    { en: "Please", es: "Por favor" },
    { en: "Thank you", es: "Gracias" },
    { en: "I don't understand", es: "No entiendo" },
    { en: "Can you repeat?", es: "¿Puedes repetir?" },
    { en: "Speak slowly, please", es: "Hable despacio, por favor" },
    { en: "Help me", es: "Ayúdame" },
  ],
  Greetings: [
    { en: "Hello", es: "Hola" },
    { en: "Good morning", es: "Buenos días" },
    { en: "Good afternoon", es: "Buenas tardes" },
    { en: "Good night", es: "Buenas noches" },
    { en: "How are you?", es: "¿Cómo estás?" },
    { en: "I am fine, thanks", es: "Estoy bien, gracias" },
    { en: "See you later", es: "Hasta luego" },
  ],
  Travel: [
    { en: "Where is the bathroom?", es: "¿Dónde está el baño?" },
    { en: "How much is this?", es: "¿Cuánto cuesta esto?" },
    { en: "I want water, please", es: "Quiero agua, por favor" },
    { en: "The bill, please", es: "La cuenta, por favor" },
    { en: "I am lost", es: "Estoy perdido" },
    { en: "Do you speak Spanish?", es: "¿Hablas español?" },
  ],
  Social: [
    { en: "My name is...", es: "Mi nombre es..." },
    { en: "I am from...", es: "Soy de..." },
    { en: "Nice to meet you", es: "Mucho gusto" },
    { en: "I like coffee", es: "Me gusta el café" },
    { en: "I have a question", es: "Tengo una pregunta" },
  ],
  Feelings: [
    { en: "I am happy", es: "Estoy feliz" },
    { en: "I am tired", es: "Estoy cansado" },
    { en: "I am hungry", es: "Tengo hambre" },
    { en: "I am thirsty", es: "Tengo sed" },
    { en: "I am sick", es: "Estoy enfermo" },
  ]
};

export const TTSDrill: React.FC = () => {
  const [activeCat, setActiveCat] = useState<Category>('Survival');
  const [loading, setLoading] = useState<number | null>(null);
  const [playing, setPlaying] = useState<number | null>(null);
  const [errorId, setErrorId] = useState<number | null>(null);
  
  // Ref to track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handlePlay = async (text: string, index: number) => {
    if (loading !== null) return;
    setLoading(index);
    setErrorId(null);
    
    try {
      await playTTS(text);
    } catch (e) {
      console.error(e);
      if (isMounted.current) {
        setErrorId(index);
      }
    } finally {
      if (isMounted.current) {
        setLoading(null);
        setPlaying(null);
      }
    }
  };

  const currentPhrases = DATA[activeCat] || [];

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl mx-4 mt-6 border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors duration-300">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Frases Útiles</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Escucha, repite y memoriza.</p>

      {/* Category Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-4 mb-2 no-scrollbar">
        {(Object.keys(DATA) as Category[]).map((cat) => (
          <button
            key={cat}
            onClick={() => { setActiveCat(cat); setErrorId(null); }}
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              activeCat === cat
                ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25'
                : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
      
      {/* List */}
      <div className="space-y-3 h-80 overflow-y-auto pr-1">
        {currentPhrases.map((phrase, idx) => (
          <div key={idx} className="bg-slate-50 dark:bg-slate-700/30 hover:bg-slate-100 dark:hover:bg-slate-700/60 border border-slate-200 dark:border-slate-700/50 p-4 rounded-xl flex items-center justify-between transition-colors">
            <div>
              <p className="text-slate-800 dark:text-white font-semibold text-lg leading-tight">{phrase.en}</p>
              <p className="text-brand-700 dark:text-brand-200/60 text-sm mt-1">{phrase.es}</p>
            </div>
            <button
              onClick={() => handlePlay(phrase.en, idx)}
              disabled={loading !== null}
              className={`p-3 rounded-full flex-shrink-0 transition-all ${
                loading === idx 
                  ? 'bg-slate-200 dark:bg-slate-600 text-slate-400' 
                  : errorId === idx
                    ? 'bg-red-100 dark:bg-red-900/30 text-red-500 border border-red-200 dark:border-red-800'
                    : 'bg-brand-600 text-white hover:bg-brand-500 shadow-md'
              }`}
              aria-label={errorId === idx ? "Retry" : `Listen to ${phrase.en}`}
            >
              {loading === idx ? (
                 <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : errorId === idx ? (
                 <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};