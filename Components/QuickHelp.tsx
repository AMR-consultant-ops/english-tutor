
import React, { useState } from 'react';
import { getGeminiClient } from '../services/geminiService';

export const QuickHelp: React.FC = () => {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResponse('');
    
    try {
      const ai = getGeminiClient();
      // Using gemini-2.5-flash for fast, low-latency text responses
      const result = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate to Spanish and explain simply for a beginner: "${query}"`,
      });
      
      setResponse(result.text || "No pude entender eso.");
    } catch (err) {
      setResponse("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-800 rounded-3xl mx-4 mt-6 border border-slate-200 dark:border-slate-700/50 shadow-sm transition-colors duration-300">
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4">Ayuda Rápida</h3>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">¿Dudas con una palabra? Pregúntale a Flash.</p>
      
      <form onSubmit={handleAsk} className="flex gap-2">
        <input 
          type="text" 
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Escribe una palabra..."
          className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:border-brand-500 transition-colors"
        />
        <button 
          type="submit" 
          disabled={loading}
          className="bg-brand-600 hover:bg-brand-500 text-white px-4 rounded-xl font-bold disabled:opacity-50"
        >
          {loading ? '...' : 'Go'}
        </button>
      </form>

      {response && (
        <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border-l-4 border-brand-500 shadow-sm">
          <p className="text-slate-700 dark:text-slate-200">{response}</p>
        </div>
      )}
    </div>
  );
};
