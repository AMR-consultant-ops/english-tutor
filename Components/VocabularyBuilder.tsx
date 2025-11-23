import React, { useState } from 'react';
import { getGeminiClient } from '../services/geminiService';
import { Type } from '@google/genai';
import { playTTS } from '../utils/ttsUtils';
import { useProgress, POINTS } from '../hooks/useProgress';

interface WordCard {
  word: string;
  translation: string;
  sentence: string;
}

// Topics mapped to specific CEFR Communicative Competencies
const TOPICS = [
  { 
    id: 'family', 
    label: 'Familia', 
    icon: '👨‍👩‍👧',
    cefrContext: 'Descriptor 16: Can describe him/herself, what he/she does and where he/she lives. (Focus on family members and relationships).'
  },
  { 
    id: 'home', 
    label: 'La Casa', 
    icon: '🏠',
    cefrContext: 'Descriptor 69: Can describe simple aspects of their everyday life. (Focus on rooms, furniture, and daily routines).'
  },
  { 
    id: 'food', 
    label: 'Comida', 
    icon: '🍔',
    cefrContext: 'Descriptor 26: Can ask for and provide everyday goods and services. (Focus on ordering food, ingredients, and taste).'
  },
  { 
    id: 'body', 
    label: 'El Cuerpo', 
    icon: '👂',
    cefrContext: 'Descriptor 70: Can describe symptoms in a simple way to a doctor. (Focus on body parts and simple health conditions).'
  },
  { 
    id: 'clothes', 
    label: 'Ropa', 
    icon: '👕',
    cefrContext: 'Descriptor 27: Obtaining goods. (Focus on clothing items, sizes, colors, and asking for prices).'
  },
  { 
    id: 'city', 
    label: 'La Ciudad', 
    icon: '🏙️',
    cefrContext: 'Descriptor 31: Can ask for and give directions. (Focus on places in town like bank, post office, station).'
  },
  { 
    id: 'numbers', 
    label: 'Precios', 
    icon: '🏷️',
    cefrContext: 'Descriptor 91: Can handle numbers, quantities, cost and time. (Focus on shopping context).'
  },
  { 
    id: 'time', 
    label: 'El Tiempo', 
    icon: '⌚',
    cefrContext: 'Descriptor 30: Can ask and tell what day, time of day and date it is.'
  },
];

export const VocabularyBuilder: React.FC = () => {
  const [words, setWords] = useState<WordCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentTopic, setCurrentTopic] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState<string | null>(null);

  // Progress Hook
  const { isCompleted, toggleProgress } = useProgress('vocab');

  const fetchVocab = async (topicLabel: string, cefrContext: string) => {
    setLoading(true);
    setCurrentTopic(topicLabel);
    setWords([]);
    
    let retries = 3;
    while (retries > 0) {
      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Generate 6 essential English vocabulary words/phrases for an A1 beginner.
          
          **TOPIC:** ${topicLabel}
          **CEFR CONTEXT:** ${cefrContext}
          
          The words must be useful for fulfilling the specific CEFR descriptor mentioned above.
          Return a JSON object with a list of items. Each item must have:
          - word (English word or short phrase)
          - translation (Spanish)
          - sentence (A very simple example sentence using the word in the context of the CEFR descriptor)`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      translation: { type: Type.STRING },
                      sentence: { type: Type.STRING },
                    },
                    required: ["word", "translation", "sentence"]
                  }
                }
              },
              required: ["items"]
            }
          }
        });

        if (response.text) {
          const data = JSON.parse(response.text);
          setWords(data.items || []);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.error(e);
        retries--;
        if (retries === 0) {
           alert("Error conectando con el tutor.");
           setLoading(false);
        } else {
           await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  };

  const playWord = async (text: string) => {
    if (audioLoading) return;
    setAudioLoading(text);
    try {
      await playTTS(text);
    } catch (e) {
      console.error(e);
    } finally {
      setAudioLoading(null);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl mx-4 mt-6 border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors duration-300">
      <div className="flex justify-between items-center mb-4">
        <div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Vocabulario</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Aprende palabras útiles para situaciones reales.</p>
        </div>
        {currentTopic && (
            <button onClick={() => setCurrentTopic(null)} className="text-xs text-brand-600 dark:text-brand-400 underline">
                Cambiar tema
            </button>
        )}
      </div>

      {!currentTopic ? (
        <div className="grid grid-cols-4 gap-3">
          {TOPICS.map((t) => {
            const isDone = isCompleted(t.id);
            return (
              <div key={t.id} className="relative group">
                <button
                  onClick={() => fetchVocab(t.label, t.cefrContext)}
                  className={`w-full aspect-square flex flex-col items-center justify-center rounded-2xl border transition-all hover:scale-105 shadow-sm ${
                    isDone
                      ? 'bg-brand-50/50 dark:bg-brand-900/10 border-brand-500 dark:border-brand-500/50'
                      : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-600'
                  }`}
                >
                  <span className="text-2xl mb-1">{t.icon}</span>
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-bold uppercase tracking-tighter leading-tight text-center px-1">{t.label}</span>
                </button>
                {/* Mini Toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleProgress(t.id);
                  }}
                  className={`absolute -top-1 -right-1 p-1 rounded-full z-10 transition-all shadow-sm flex items-center justify-center ${
                    isDone
                      ? 'bg-brand-500 text-white scale-100 w-5 h-5'
                      : 'bg-slate-200 dark:bg-slate-600 text-slate-400 scale-75 opacity-0 group-hover:opacity-100 hover:scale-100 hover:bg-slate-300 w-4 h-4'
                  }`}
                  title={isDone ? "Completed (+5 XP)" : "Mark as Done"}
                >
                  {isDone ? (
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  ) : (
                    <span className="text-[8px] font-bold">+</span>
                  )}
                </button>
                {isDone && <span className="absolute -bottom-2 bg-yellow-400 text-white text-[8px] px-1 rounded-full left-1/2 -translate-x-1/2 shadow-sm font-bold">+{POINTS.vocab}</span>}
              </div>
          )})}
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-brand-700 dark:text-brand-200 text-sm animate-pulse">Buscando palabras clave...</p>
        </div>
      ) : (
        <div className="space-y-3">
           {words && words.length > 0 ? words.map((item, idx) => (
             <div key={idx} className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-col gap-2 animate-in fade-in slide-in-from-bottom-2 shadow-sm" style={{animationDelay: `${idx * 100}ms`}}>
                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2">
                    <div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white block">{item.word}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">{item.translation}</span>
                    </div>
                    <button 
                        onClick={() => playWord(item.word)}
                        className={`p-2 rounded-full ${audioLoading === item.word ? 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500' : 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400 hover:bg-brand-500 hover:text-white'} transition-colors`}
                    >
                        {audioLoading === item.word ? (
                            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"/>
                        ) : (
                           <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                        )}
                    </button>
                </div>
                <div className="flex items-start gap-2">
                    <span className="text-slate-400 dark:text-slate-600 text-xs mt-0.5">Ej:</span>
                    <div className="flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-tight">{item.sentence}</p>
                        <button onClick={() => playWord(item.sentence)} className="text-[10px] text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 mt-1">Escuchar oración</button>
                    </div>
                </div>
             </div>
           )) : (
             <div className="text-center text-slate-400 py-8">No se encontraron palabras. Intenta de nuevo.</div>
           )}
           <div className="pt-4">
                <button onClick={() => fetchVocab(currentTopic!, TOPICS.find(t => t.label === currentTopic)?.cefrContext || '')} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-600">
                    Generar otras palabras
                </button>
           </div>
        </div>
      )}
    </div>
  );
};