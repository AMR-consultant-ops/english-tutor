import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LiveServerMessage, Modality, Type } from '@google/genai';
import { getGeminiClient } from '../services/geminiService';
import { createPcmBlob, decodeAudioData, PCM_SAMPLE_RATE } from '../utils/audioUtils';
import { Visualizer } from './Visualizer.tsx';
import { playTTS } from '../utils/ttsUtils'; 
import { PRE_A1_VOCABULARY, A1_VOCABULARY } from '../vocabulary';
import { useProgress, POINTS } from '../hooks/useProgress';
import { 
  AudioVisualizerState, 
  Message, 
  UserLevel, 
  UserAccent,
  getSystemInstruction, 
  LiveTopic, 
  PRE_A1_TOPICS, 
  A1_TOPICS 
} from '../types';

interface VocabItem {
  word: string;
  translation: string;
}

interface GeneratedScenario {
  title: string;
  description: string;
  roleplayContext: string; 
  vocabulary: VocabItem[]; 
}

export const LiveTutor: React.FC = () => {
  // --- STATE MANAGEMENT ---
  const [step, setStep] = useState<'MENU' | 'SCENARIOS' | 'PREP' | 'LIVE'>('MENU');
  const [connected, setConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false); 
  const [isLoadingScenarios, setIsLoadingScenarios] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [visState, setVisState] = useState<AudioVisualizerState>('idle');
  const [transcript, setTranscript] = useState<Message[]>([]);
  
  // Selection State
  const [activeTab, setActiveTab] = useState<UserLevel>('PRE_A1');
  const [voiceGender, setVoiceGender] = useState<'male'|'female'>('male');
  const [voiceAccent, setVoiceAccent] = useState<UserAccent>('US');

  const [selectedTopic, setSelectedTopic] = useState<LiveTopic | null>(null);
  const [generatedScenarios, setGeneratedScenarios] = useState<GeneratedScenario[]>([]);
  const [activeScenario, setActiveScenario] = useState<GeneratedScenario | null>(null);
  
  // Progress Hook
  const { isCompleted, toggleProgress, markAsComplete } = useProgress('live');
  
  // --- AUDIO REFS ---
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const sessionRef = useRef<Promise<any> | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // UI Refs
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // --- CLEANUP ---
  const stopSession = useCallback(() => {
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(console.error);
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(console.error);
      outputAudioContextRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    sourcesRef.current.forEach(source => source.stop());
    sourcesRef.current.clear();

    setConnected(false);
    setIsConnecting(false);
    setVisState('idle');
    sessionRef.current = null;
    
    // If we stop the session, go back to Scenario selection
    setStep('SCENARIOS'); 
  }, []);

  const finishSession = () => {
    // CRITICAL: Award points immediately before any cleanup happens
    if (selectedTopic) {
        console.log(`Awarding ${POINTS.live} XP for topic ${selectedTopic.id}`);
        markAsComplete(selectedTopic.id);
    }
    stopSession();
  };

  // --- STEP 1: GENERATE SCENARIOS ---
  const fetchScenarios = async (topic: LiveTopic) => {
    setIsLoadingScenarios(true);
    setSelectedTopic(topic);
    setGeneratedScenarios([]);
    setError(null);
    
    // Simple retry logic
    let retries = 3;
    while (retries > 0) {
        try {
            const ai = getGeminiClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Create 3 distinct roleplay scenarios for a beginner English student (${activeTab} Level).
                
                **TOPIC:** ${topic.label}
                **CEFR GOAL:** ${topic.cefrGoal}
                
                **INSTRUCTION:**
                1. Design 3 scenarios to practice the goal.
                2. For EACH scenario, provide 5-6 essential vocabulary words (English + Spanish) that the student will need to succeed in that specific roleplay.

                Output JSON.`,
                config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                    scenarios: {
                        type: Type.ARRAY,
                        items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING, description: "Short title in Spanish" },
                            description: { type: Type.STRING, description: "1 sentence explanation in Spanish" },
                            roleplayContext: { type: Type.STRING, description: "Internal instruction for the AI Roleplay agent explaining the setting and roles in English." },
                            vocabulary: {
                            type: Type.ARRAY,
                            description: "List of key words for this specific scenario",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                word: { type: Type.STRING },
                                translation: { type: Type.STRING }
                                },
                                required: ["word", "translation"]
                            }
                            }
                        },
                        required: ["title", "description", "roleplayContext", "vocabulary"]
                        }
                    }
                    },
                    required: ["scenarios"]
                }
                }
            });

            if (response.text) {
                let jsonText = response.text;
                jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '').trim();
                
                const data = JSON.parse(jsonText);
                if (data.scenarios && Array.isArray(data.scenarios)) {
                    setGeneratedScenarios(data.scenarios);
                    setStep('SCENARIOS');
                    setIsLoadingScenarios(false);
                    return; // Success
                }
            }
            throw new Error("Invalid format");
        } catch (err) {
            console.error("Attempt failed", err);
            retries--;
            if (retries === 0) {
                setError("Error generando lecciones. Por favor revisa tu conexión.");
                setIsLoadingScenarios(false);
            } else {
                // Wait 1s before retry
                await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
  };

  // --- PREP: PLAY WORD AUDIO ---
  const playWordAudio = async (text: string) => {
    if (audioPlaying) return;
    setAudioPlaying(text);
    try {
      const selectedVoice = voiceGender === 'male' ? 'Puck' : 'Kore';
      await playTTS(text, selectedVoice);
    } catch (e) {
      console.error("Audio error", e);
      // No alert to avoid spamming the user, but we clear loading state in finally
    } finally {
      setAudioPlaying(null);
    }
  };

  const handleScenarioSelect = (scenario: GeneratedScenario) => {
    setActiveScenario(scenario);
    setStep('PREP');
  }

  // --- STEP 3: START LIVE SESSION ---
  const startSession = async () => {
    const scenario = activeScenario;
    if (!scenario || !selectedTopic) {
      setError("Error: No topic selected.");
      setStep('MENU');
      return;
    }
    if (isConnecting) return;

    if (connected) {
       stopSession();
       await new Promise(r => setTimeout(r, 100));
    }
    
    setStep('LIVE');
    setError(null);
    setIsConnecting(true);

    try {
      const ai = getGeminiClient();
      
      const vocabList = activeTab === 'PRE_A1' ? PRE_A1_VOCABULARY : A1_VOCABULARY;
      const cefrGoal = selectedTopic.cefrGoal;

      const InputContextClass = window.AudioContext || (window as any).webkitAudioContext;
      inputAudioContextRef.current = new InputContextClass({ sampleRate: PCM_SAMPLE_RATE });
      
      const OutputContextClass = window.AudioContext || (window as any).webkitAudioContext;
      outputAudioContextRef.current = new OutputContextClass({ sampleRate: 24000 });
      
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      setConnected(true);
      setVisState('listening');
      setTranscript([]); 

      const selectedVoice = voiceGender === 'male' ? 'Puck' : 'Kore';

      const scenarioVocabString = scenario.vocabulary 
        ? scenario.vocabulary.map(v => v.word).join(', ') 
        : '';

      const instructionString = getSystemInstruction(
        activeTab, 
        selectedTopic.label, 
        scenario.roleplayContext || scenario.description, 
        cefrGoal, 
        vocabList + ", " + scenarioVocabString,
        voiceAccent
      );

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: instructionString, 
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            console.log("Live Session Opened");
            setIsConnecting(false);
            
            if (!inputAudioContextRef.current) return;
            sourceRef.current = inputAudioContextRef.current.createMediaStreamSource(stream);
            processorRef.current = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            processorRef.current.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createPcmBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            sourceRef.current.connect(processorRef.current);
            processorRef.current.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const outputCtx = outputAudioContextRef.current;
            if (!outputCtx) return;

            if (msg.serverContent?.outputTranscription?.text) {
               const text = msg.serverContent.outputTranscription.text;
               setVisState('speaking');
               setTranscript(prev => {
                   const last = prev[prev.length - 1];
                   if (last && last.role === 'model') {
                       return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                   }
                   return [...prev, { id: Date.now().toString(), role: 'model', text, timestamp: Date.now() }];
               });
            }
            if (msg.serverContent?.inputTranscription?.text) {
               const text = msg.serverContent.inputTranscription.text;
               setVisState('listening');
               setTranscript(prev => {
                   const last = prev[prev.length - 1];
                   if (last && last.role === 'user') {
                       return [...prev.slice(0, -1), { ...last, text: last.text + text }];
                   }
                   return [...prev, { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() }];
               });
            }

            const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio) {
              setVisState('speaking');
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
              
              try {
                const audioBuffer = await decodeAudioData(base64Audio, outputCtx);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                
                const gainNode = outputCtx.createGain();
                gainNode.gain.value = 1.0; 
                
                source.connect(gainNode);
                gainNode.connect(outputCtx.destination);
                
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                
                sourcesRef.current.add(source);
                source.onended = () => {
                  sourcesRef.current.delete(source);
                  if (sourcesRef.current.size === 0) {
                     setVisState('listening');
                  }
                };
              } catch (e) {
                console.error("Error decoding audio", e);
              }
            }

            if (msg.serverContent?.interrupted) {
              sourcesRef.current.forEach(src => src.stop());
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
              setVisState('listening');
            }
          },
          onclose: () => {
            console.log("Session Closed");
            stopSession();
          },
          onerror: (err) => {
            console.error("Session Error", err);
            setError("Conexión perdida. Intenta de nuevo.");
            stopSession();
          }
        }
      });
      
      sessionPromise.catch(err => {
        console.error("Connection Failed", err);
        setError("No se pudo conectar con el tutor.");
        stopSession();
      });

      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setError("Error al iniciar la clase.");
      stopSession();
    }
  };

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, [stopSession]);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [transcript]);

  const currentTopics = activeTab === 'PRE_A1' ? PRE_A1_TOPICS : A1_TOPICS;

  // --- RENDER LOADING ---
  if (isLoadingScenarios) {
    return (
        <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 items-center justify-center p-6 space-y-6 transition-colors duration-300">
            <div className="w-16 h-16 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
            <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Diseñando clase...</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Creando situaciones para {selectedTopic?.label}</p>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white relative transition-colors duration-300">
      
      {/* --- HEADER (DYNAMIC) --- */}
      <div className={`flex-shrink-0 flex flex-col items-center justify-center p-6 transition-all duration-500 ${connected ? 'h-48 bg-white/50 dark:bg-slate-800/50' : 'h-auto min-h-[10vh]'}`}>
        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-600 dark:text-red-200 px-4 py-2 rounded-lg max-w-sm text-center mb-4 text-sm">
            {error}
          </div>
        )}
        
        {connected ? (
          <>
             <Visualizer state={visState} />
             <div className="text-center mt-4">
               <span className="inline-block px-2 py-1 rounded bg-brand-100 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 text-xs font-bold uppercase tracking-wider mb-1">
                 {activeScenario?.title}
               </span>
               <p className="text-slate-500 dark:text-slate-300 text-sm animate-pulse">
                 {visState === 'speaking' ? 'Escuchando...' : 'Tu turno...'}
               </p>
             </div>
          </>
        ) : (
           /* HEADER FOR MENUS */
           <div className="text-center space-y-2 relative w-full">
             {step === 'SCENARIOS' && (
                 <button onClick={() => setStep('MENU')} className="absolute top-0 left-0 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-white flex items-center gap-1 text-sm">
                     ← Volver
                 </button>
             )}
             {step === 'PREP' && (
                 <button onClick={() => setStep('SCENARIOS')} className="absolute top-0 left-0 text-slate-500 dark:text-slate-400 hover:text-brand-600 dark:hover:text-white flex items-center gap-1 text-sm">
                     ← Volver
                 </button>
             )}
             
             {step === 'MENU' && (
               <>
                 <h2 className="text-2xl font-bold tracking-tight">Configura tu Clase</h2>
                 <p className="text-slate-500 dark:text-slate-400 text-sm">Personaliza tu experiencia.</p>
               </>
             )}
             
             {(step === 'SCENARIOS' || step === 'PREP') && (
               <>
                 <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-500/10 mb-1 animate-pulse-slow">
                    <span className="text-2xl">{selectedTopic ? selectedTopic.icon : '👋'}</span>
                 </div>
                 <h2 className="text-xl font-bold tracking-tight">
                     {selectedTopic?.label}
                 </h2>
               </>
             )}
           </div>
        )}
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 relative transition-colors duration-300">
        
        {!connected ? (
           <div className="p-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-24">
              
              {/* VIEW 1: TOPIC MENU */}
              {step === 'MENU' && (
                  <div className="space-y-6">
                    
                    {/* SECTION 1: TUTOR CONFIG */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-5 h-5 bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center text-[10px] border border-brand-200 dark:border-brand-700">1</span>
                            Personaliza tu Tutor
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Voz</label>
                                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setVoiceGender('male')}
                                        className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${voiceGender === 'male' ? 'bg-white dark:bg-slate-600 text-brand-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                                    >
                                        👨 Male
                                    </button>
                                    <button 
                                        onClick={() => setVoiceGender('female')}
                                        className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${voiceGender === 'female' ? 'bg-white dark:bg-slate-600 text-brand-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                                    >
                                        👩 Female
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 ml-1">Acento</label>
                                <div className="flex bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                                    <button 
                                        onClick={() => setVoiceAccent('US')}
                                        className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${voiceAccent === 'US' ? 'bg-white dark:bg-slate-600 text-brand-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                                    >
                                        🇺🇸 USA
                                    </button>
                                    <button 
                                        onClick={() => setVoiceAccent('UK')}
                                        className={`flex-1 py-2 rounded-md text-xs font-bold transition-colors ${voiceAccent === 'UK' ? 'bg-white dark:bg-slate-600 text-brand-700 dark:text-white shadow-sm' : 'text-slate-400'}`}
                                    >
                                        🇬🇧 UK
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: LEVEL SELECTION */}
                    <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <span className="w-5 h-5 bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center text-[10px] border border-brand-200 dark:border-brand-700">2</span>
                            Elige tu Nivel
                        </h3>
                        <div className="flex gap-3">
                            <button
                            onClick={() => setActiveTab('PRE_A1')}
                            className={`flex-1 py-3 px-2 rounded-xl text-sm font-bold transition-all duration-200 border ${
                                activeTab === 'PRE_A1'
                                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-500 text-brand-700 dark:text-brand-300 shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-700/30 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            >
                            Principiante
                            </button>
                            <button
                            onClick={() => setActiveTab('A1')}
                            className={`flex-1 py-3 px-2 rounded-xl text-sm font-bold transition-all duration-200 border ${
                                activeTab === 'A1'
                                ? 'bg-brand-50 dark:bg-brand-900/30 border-brand-500 text-brand-700 dark:text-brand-300 shadow-sm'
                                : 'bg-slate-50 dark:bg-slate-700/30 border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                            }`}
                            >
                            Básico
                            </button>
                        </div>
                    </div>

                    {/* SECTION 3: TOPICS */}
                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2 px-1">
                            <span className="w-5 h-5 bg-brand-100 dark:bg-brand-900 text-brand-600 dark:text-brand-400 rounded-full flex items-center justify-center text-[10px] border border-brand-200 dark:border-brand-700">3</span>
                            Elige un Tema
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {currentTopics.map((topic) => {
                              const isDone = isCompleted(topic.id);
                              return (
                                <div key={topic.id} className="relative group">
                                  <button
                                      onClick={() => fetchScenarios(topic)}
                                      className={`w-full bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border p-4 rounded-2xl flex flex-col items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md active:scale-95 min-h-[110px] ${
                                        isDone 
                                          ? 'border-brand-500 dark:border-brand-500/50 bg-brand-50/50 dark:bg-brand-900/10' 
                                          : 'border-slate-200 dark:border-slate-700 hover:border-brand-500/50'
                                      }`}
                                  >
                                      <span className="text-3xl group-hover:scale-110 transition-transform duration-300">{topic.icon}</span>
                                      <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-100 text-sm">{topic.label}</span>
                                      {isDone && <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">+{POINTS.live} XP</span>}
                                  </button>
                                  {/* Progress Toggle Button */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleProgress(topic.id);
                                    }}
                                    className={`absolute top-2 right-2 p-1.5 rounded-full z-10 transition-all ${
                                      isDone
                                        ? 'bg-brand-500 text-white shadow-sm'
                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-300 dark:text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-600'
                                    }`}
                                    title={isDone ? "Marcar como pendiente" : "Marcar como completado"}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      {isDone ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-7-7v14" />
                                      )}
                                    </svg>
                                  </button>
                                </div>
                            )})}
                        </div>
                    </div>
                  </div>
              )}

              {/* VIEW 2: SCENARIO SELECTION */}
              {step === 'SCENARIOS' && (
                  <div className="space-y-4">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Elige una situación para practicar:</p>
                      {generatedScenarios.map((scen, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleScenarioSelect(scen)}
                            disabled={isConnecting}
                            className="w-full text-left bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700 hover:border-brand-500 p-5 rounded-2xl transition-all shadow-sm hover:shadow-md group active:scale-[0.98]"
                          >
                             <div className="flex justify-between items-center mb-2">
                                 <span className="font-bold text-lg text-brand-700 dark:text-brand-200 group-hover:text-brand-600 dark:group-hover:text-brand-100">{scen.title}</span>
                             </div>
                             <p className="text-slate-500 dark:text-slate-400 text-sm">{scen.description}</p>
                          </button>
                      ))}
                      <button onClick={() => fetchScenarios(selectedTopic!)} className="w-full py-3 text-sm text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 underline">
                          Generar otras situaciones...
                      </button>
                  </div>
              )}

              {/* VIEW 3: WARM-UP / PREP */}
              {step === 'PREP' && activeScenario && (
                  <div className="space-y-6">
                      <div className="bg-brand-50 dark:bg-brand-900/30 border border-brand-200 dark:border-brand-800 p-5 rounded-2xl text-center">
                          <h3 className="text-lg font-bold text-brand-800 dark:text-brand-200 mb-1">¡Prepárate!</h3>
                          <p className="text-sm text-brand-600 dark:text-brand-400">Escucha estas palabras antes de empezar.</p>
                      </div>

                      <div className="grid grid-cols-1 gap-3">
                          {activeScenario.vocabulary?.map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => playWordAudio(item.word)}
                                className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-400 dark:hover:border-brand-600 transition-colors shadow-sm active:scale-[0.99]"
                              >
                                  <div className="text-left">
                                      <span className="block font-bold text-slate-800 dark:text-white text-lg">{item.word}</span>
                                      <span className="block text-sm text-slate-500 dark:text-slate-400">{item.translation}</span>
                                  </div>
                                  <div className={`p-2 rounded-full ${audioPlaying === item.word ? 'bg-slate-200 dark:bg-slate-700' : 'bg-brand-100 dark:bg-brand-500/20 text-brand-600 dark:text-brand-400'}`}>
                                      {audioPlaying === item.word ? (
                                         <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"/>
                                      ) : (
                                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                                      )}
                                  </div>
                              </button>
                          ))}
                      </div>

                      <div className="pt-4">
                          <button
                            onClick={startSession}
                            disabled={isConnecting}
                            className="w-full bg-brand-600 hover:bg-brand-500 text-white p-5 rounded-2xl font-bold text-xl shadow-lg shadow-brand-500/30 flex items-center justify-center gap-3 transition-transform active:scale-95"
                          >
                             {isConnecting ? (
                               <>
                                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                 Conectando...
                               </>
                             ) : (
                               <>
                                 <span>Empezar Clase</span>
                                 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
                               </>
                             )}
                          </button>
                      </div>
                  </div>
              )}
           </div>
        ) : (
          /* VIEW 4: LIVE TRANSCRIPT */
          <div 
            ref={transcriptContainerRef}
            className="h-full overflow-y-auto px-4 py-4 space-y-4 mask-image-gradient"
          >
            {transcript.length === 0 && (
              <div className="text-center text-slate-500 text-sm mt-10 italic">
                Conectando con el tutor...
              </div>
            )}
            {transcript.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed shadow-md ${
                        msg.role === 'user' 
                        ? 'bg-brand-600 text-white rounded-tr-none' 
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-transparent rounded-tl-none'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            <div ref={transcriptEndRef} className="h-24" />
          </div>
        )}

        {/* Floating Stop Button (Only when connected) */}
        {connected && (
           <div className="absolute bottom-6 left-0 right-0 flex justify-center z-20">
             <button
               onClick={finishSession}
               className="bg-red-500 hover:bg-red-600 text-white px-8 py-4 rounded-full font-bold shadow-2xl shadow-red-500/30 flex items-center gap-2 hover:scale-105 transition-transform"
             >
               <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
               Terminar Clase (+{POINTS.live} XP)
             </button>
           </div>
        )}
      </div>
    </div>
  );
};
