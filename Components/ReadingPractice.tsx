import React, { useState } from 'react';
import { getGeminiClient } from '../services/geminiService';
import { Type } from '@google/genai';
import { useProgress, POINTS } from '../hooks/useProgress';

interface VocabItem {
  word: string;
  translation: string;
  sentence: string;
}

interface Question {
  text: string;
  options: string[];
  correctIndex: number;
}

interface StoryOption {
  title: string;
  summary: string;
  difficulty: string;
}

interface Lesson {
  title: string;
  vocabulary: VocabItem[];
  story: string;
  questions: Question[];
}

// Mapped specific CEFR Descriptors to topics to ensure pedagogical alignment
const TOPICS = [
  { 
    id: 'news', 
    label: 'Noticias', 
    icon: '📰', 
    cefrGoal: 'Descriptor 54: Can understand short, simple texts on familiar matters of a concrete type which consist of high frequency everyday or job-related language.' 
  },
  { 
    id: 'animals', 
    label: 'Animales', 
    icon: '🐾', 
    cefrGoal: 'Descriptor 61: Can get an idea of the content of simpler informational material and short, simple descriptions.' 
  },
  { 
    id: 'food', 
    label: 'Comida', 
    icon: '🍔', 
    cefrGoal: 'Descriptor 27: Can order a meal. (Focus on reading a menu, a recipe, or a restaurant review).' 
  },
  { 
    id: 'travel', 
    label: 'Viajes', 
    icon: '✈️', 
    cefrGoal: 'Descriptor 58: Can understand information guides (e.g. hotel information, where floors/departments are).' 
  },
  { 
    id: 'sports', 
    label: 'Deportes', 
    icon: '⚽', 
    cefrGoal: 'Descriptor 55: Can understand short simple personal letters/emails (e.g. a fan writing about a match).' 
  },
  { 
    id: 'tech', 
    label: 'Tecnología', 
    icon: '📱', 
    cefrGoal: 'Descriptor 13: Can understand short, simple instructions (e.g. how to use a phone or machine).' 
  },
];

export const ReadingPractice: React.FC = () => {
  const [step, setStep] = useState<'TOPICS' | 'OPTIONS' | 'LESSON'>('TOPICS');
  const [loading, setLoading] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [selectedTopicLabel, setSelectedTopicLabel] = useState<string>('');
  const [currentCefrGoal, setCurrentCefrGoal] = useState<string>('');
  
  const [storyOptions, setStoryOptions] = useState<StoryOption[]>([]);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  
  const [activeTab, setActiveTab] = useState<'vocab' | 'reading' | 'quiz'>('vocab');
  const [quizAnswers, setQuizAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  // Progress Hook
  const { isCompleted, markAsComplete } = useProgress('reading');

  // STEP 1: Generate Options
  const fetchStoryOptions = async (topicId: string, topicLabel: string, cefrGoal: string) => {
    setLoading(true);
    setSelectedTopicId(topicId);
    setSelectedTopicLabel(topicLabel);
    setCurrentCefrGoal(cefrGoal);
    setStoryOptions([]);
    
    let retries = 3;
    while (retries > 0) {
      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Generate 3 distinct reading material ideas for an A1 (Beginner) English student.
          
          **PEDAGOGICAL GOAL:** ${cefrGoal}
          **TOPIC:** ${topicLabel}
          
          The 3 options must vary in text type but stick to the A1 level:
          1. Option 1: "Easy" (e.g., A short list, a poster, or very simple note).
          2. Option 2: "Medium" (e.g., A short email or simple description).
          3. Option 3: "Hard" (e.g., A short story or simple news snippet).

          Output JSON with a list of 3 options. Each option must have:
          - title: A short, catchy title in English.
          - summary: A 1-sentence summary in Spanish so the user knows what it is about.
          - difficulty: "Easy", "Medium", or "Hard"`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      summary: { type: Type.STRING },
                      difficulty: { type: Type.STRING },
                    },
                    required: ["title", "summary", "difficulty"]
                  }
                }
              },
              required: ["options"]
            }
          }
        });

        if (response.text) {
          const data = JSON.parse(response.text);
          setStoryOptions(data.options || []);
          setStep('OPTIONS');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error(error);
        retries--;
        if (retries === 0) {
           alert("Error obteniendo temas. Verifica tu conexión.");
           setLoading(false);
        } else {
           await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  };

  // STEP 2: Generate Full Lesson
  const generateLesson = async (option: StoryOption) => {
    setLoading(true);
    setLesson(null);
    setQuizAnswers({});
    setShowResults(false);
    setActiveTab('vocab');

    let retries = 3;
    while (retries > 0) {
      try {
        const ai = getGeminiClient();
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Write a full reading lesson for an A1 student based on:
          Title: "${option.title}"
          CEFR Competency: "${currentCefrGoal}"
          Difficulty: ${option.difficulty}
          
          Structure:
          1. Title
          2. Vocabulary (5 key words with Spanish translation)
          3. Text Body (Write 10-15 sentences. Ensure the format matches the text type, e.g., email format, list format, or story format).
          4. Questions (3 reading comprehension questions with 3 options each)`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                vocabulary: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      translation: { type: Type.STRING },
                    },
                    required: ["word", "translation"]
                  }
                },
                story: { type: Type.STRING },
                questions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      text: { type: Type.STRING },
                      options: { type: Type.ARRAY, items: { type: Type.STRING } },
                      correctIndex: { type: Type.INTEGER },
                    },
                    required: ["text", "options", "correctIndex"]
                  }
                }
              },
              required: ["title", "vocabulary", "story", "questions"]
            }
          }
        });

        if (response.text) {
          const parsed = JSON.parse(response.text) as Lesson;
          parsed.vocabulary = parsed.vocabulary || [];
          parsed.questions = parsed.questions || [];
          setLesson(parsed);
          setStep('LESSON');
          setLoading(false);
          return;
        }
      } catch (error) {
        console.error(error);
        retries--;
        if (retries === 0) {
          alert("Error generando la lección. Verifica tu conexión.");
          setLoading(false);
        } else {
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    }
  };

  const handleAnswer = (qIndex: number, optionIndex: number) => {
    setQuizAnswers(prev => ({ ...prev, [qIndex]: optionIndex }));
  };

  const resetToTopics = () => {
    setStep('TOPICS');
    setLesson(null);
    setStoryOptions([]);
  };

  // --- RENDER LOADING ---
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center space-y-6 p-8 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="relative">
            <div className="w-20 h-20 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
            <div className="absolute top-0 left-0 w-20 h-20 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <div className="text-center space-y-2 animate-pulse">
            <p className="text-xl font-bold text-slate-900 dark:text-white">
                {step === 'TOPICS' ? 'Diseñando plan CEFR...' : 'Creando material de lectura...'}
            </p>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Adaptando al descriptor seleccionado.</p>
        </div>
      </div>
    );
  }

  // --- RENDER STEP 1: TOPICS ---
  if (step === 'TOPICS') {
    return (
      // Added pt-24 to clear global header
      <div className="p-6 pt-24 space-y-6 h-full overflow-y-auto pb-32 bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="text-center space-y-2 mb-4">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Práctica de Lectura</h2>
          <p className="text-slate-500 dark:text-slate-400">Lee sobre temas de interés.</p>
        </div>
        
        {/* Changed grid-cols-2 to sm:grid-cols-2 to fix squashed items on narrow screens */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {TOPICS.map((t) => {
            const isDone = isCompleted(t.id);
            return (
              <button
                key={t.id}
                onClick={() => fetchStoryOptions(t.id, t.label, t.cefrGoal)}
                className={`relative border p-6 rounded-2xl flex flex-col items-center gap-3 transition-all group shadow-sm hover:shadow-lg active:scale-95 ${
                  isDone 
                    ? 'bg-brand-50/50 dark:bg-brand-900/10 border-brand-500 dark:border-brand-500/50' 
                    : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 hover:border-brand-500'
                }`}
              >
                {isDone && (
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400 bg-brand-100 dark:bg-brand-900 px-1.5 py-0.5 rounded-full">+{POINTS.reading} XP</span>
                    <div className="bg-brand-500 text-white rounded-full p-0.5 shadow-sm">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                    </div>
                  </div>
                )}
                <span className="text-4xl group-hover:scale-110 transition-transform">{t.icon}</span>
                <span className="font-bold text-slate-700 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400">{t.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    );
  }

  // --- RENDER STEP 2: STORY OPTIONS ---
  if (step === 'OPTIONS') {
    return (
      <div className="p-6 pt-24 h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
        <div className="flex items-center gap-4 mb-6">
            <button onClick={resetToTopics} className="p-2 bg-white dark:bg-slate-800 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                ←
            </button>
            <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">{selectedTopicLabel}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Elige una lectura:</p>
            </div>
        </div>

        <div className="space-y-4">
            {storyOptions.map((opt, idx) => {
                let badgeColor = "bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 border-brand-200 dark:border-brand-500/30";
                if (opt.difficulty === 'Medium') badgeColor = "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/30";
                if (opt.difficulty === 'Hard') badgeColor = "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30";
                
                return (
                <button
                    key={idx}
                    onClick={() => generateLesson(opt)}
                    className="w-full text-left bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 hover:border-brand-500/50 p-5 rounded-2xl transition-all shadow-sm hover:shadow-md group active:scale-[0.98]"
                >
                    <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-lg text-brand-700 dark:text-brand-200 group-hover:text-brand-600 dark:group-hover:text-brand-100">{opt.title}</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border ${badgeColor}`}>
                            {opt.difficulty}
                        </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">{opt.summary}</p>
                </button>
            )})}
        </div>
      </div>
    );
  }

  // --- RENDER STEP 3: LESSON ---
  if (!lesson) return null;

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      {/* Header */}
      {/* Added pt-20 to clear fixed header */}
      <div className="p-6 pt-24 bg-white/80 dark:bg-slate-800/50 backdrop-blur border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
           <button onClick={() => setStep('OPTIONS')} className="text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-white text-sm flex items-center gap-1">
             ← Atrás
           </button>
           <span className="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">A1 Practice</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-tight">{lesson.title}</h2>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white/50 dark:bg-slate-900/50">
        {(['vocab', 'reading', 'quiz'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 text-xs md:text-sm font-bold uppercase tracking-wider transition-colors border-b-2 ${
              activeTab === tab 
                ? 'border-brand-500 text-brand-600 dark:text-brand-400 bg-slate-100 dark:bg-slate-800/50' 
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            {tab === 'vocab' ? '1. Words' : tab === 'reading' ? '2. Text' : '3. Quiz'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 pb-32">
        
        {activeTab === 'vocab' && (
          <div className="space-y-4 animate-in slide-in-from-right-4 fade-in duration-300">
            <p className="text-slate-500 dark:text-slate-400 mb-4 text-center text-sm">Palabras clave para este texto.</p>
            <div className="grid gap-3">
              {lesson.vocabulary?.length > 0 ? (
                lesson.vocabulary.map((item, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex justify-between items-center shadow-sm">
                    <span className="text-lg font-bold text-brand-700 dark:text-brand-200">{item.word}</span>
                    <span className="text-slate-500 dark:text-slate-400 italic">{item.translation}</span>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-4">No vocabulary words found.</div>
              )}
            </div>
            <button 
              onClick={() => setActiveTab('reading')}
              className="w-full mt-6 bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-bold shadow-lg"
            >
              Leer Texto →
            </button>
          </div>
        )}

        {activeTab === 'reading' && (
          <div className="space-y-6 animate-in slide-in-from-right-4 fade-in duration-300">
             <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700/50">
                <p className="text-lg md:text-xl leading-loose text-slate-800 dark:text-slate-200 font-medium font-serif whitespace-pre-wrap">
                  {lesson.story}
                </p>
             </div>
             <button 
              onClick={() => setActiveTab('quiz')}
              className="w-full bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-xl font-bold shadow-lg"
            >
              Preguntas →
            </button>
          </div>
        )}

        {activeTab === 'quiz' && (
          <div className="space-y-8 animate-in slide-in-from-right-4 fade-in duration-300">
            {lesson.questions?.map((q, qIdx) => (
              <div key={qIdx} className="space-y-3">
                <p className="font-bold text-slate-800 dark:text-white text-lg">{qIdx + 1}. {q.text}</p>
                <div className="space-y-2">
                  {q.options?.map((opt, oIdx) => {
                    const isSelected = quizAnswers[qIdx] === oIdx;
                    const isCorrect = q.correctIndex === oIdx;
                    
                    let btnClass = "w-full text-left p-4 rounded-xl border transition-all ";
                    
                    if (showResults) {
                      if (isCorrect) btnClass += "bg-brand-100 dark:bg-brand-500/20 border-brand-500 text-brand-800 dark:text-brand-200";
                      else if (isSelected && !isCorrect) btnClass += "bg-red-100 dark:bg-red-500/20 border-red-500 text-red-800 dark:text-red-200";
                      else btnClass += "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 opacity-50";
                    } else {
                      if (isSelected) btnClass += "bg-brand-600 border-brand-500 text-white shadow-md transform scale-[1.02]";
                      else btnClass += "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700";
                    }

                    return (
                      <button
                        key={oIdx}
                        onClick={() => !showResults && handleAnswer(qIdx, oIdx)}
                        disabled={showResults}
                        className={btnClass}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            
            {!showResults ? (
              <button 
                onClick={() => setShowResults(true)}
                disabled={Object.keys(quizAnswers).length < (lesson.questions?.length || 1)}
                className="w-full bg-brand-600 hover:bg-brand-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold shadow-lg mt-8"
              >
                Ver Resultados
              </button>
            ) : (
               <div className="text-center bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 space-y-4 shadow-sm animate-bounce">
                 <p className="text-slate-800 dark:text-slate-300 text-lg">
                    ¡Lección Completada! 🎉
                 </p>
                 <p className="text-3xl font-black text-yellow-500">
                    +{POINTS.reading} XP EARNED!
                 </p>
                 <button 
                    onClick={() => {
                        markAsComplete(selectedTopicId);
                        resetToTopics();
                    }}
                    className="w-full bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-500 shadow-lg"
                 >
                    Terminar y Guardar Progreso
                 </button>
               </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
