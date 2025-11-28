
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { LiveServerMessage, Modality, Type } from '@google/genai';
import { getGeminiClient } from '../services/geminiService';
import { createPcmBlob, decodeAudioData, PCM_SAMPLE_RATE, downsampleTo16k } from '../utils/audioUtils';
import { Visualizer } from './Visualizer';
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
  const { isCompleted, markAsComplete } = useProgress('live');
  
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
  const errorRecoveryRef = useRef(false);

  // --- CLEANUP ---
  const stopSession = useCallback((stayOnPrep = false) => {
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
    
    // CRITICAL: Prevent looping. If we are recovering from an error (stayOnPrep)
    // or if the error flag was raised, we MUST NOT go back to SCENARIOS.
    if (stayOnPrep || errorRecoveryRef.current) {
        // Stay on current step (PREP)
        console.log("Stopping session but staying on PREP due to error/request");
    } else {
        setStep('SCENARIOS'); 
    }
    errorRecoveryRef.current = false;
  }, []);

  const finishSession = () => {
    // Award points
    if (selectedTopic) {
        markAsComplete(selectedTopic.id);
    }
    stopSession(false);
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
       stopSession(true); 
       await new Promise(r => setTimeout(r, 100));
    }
    
    setStep('LIVE');
    setError(null);
    setIsConnecting(true);
    errorRecoveryRef.current = false; // Reset error flag

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
              // Downsample to 16k before sending
              const downsampledData = downsampleTo16k(inputData, inputAudioContextRef.current!.sampleRate);
              const pcmBlob = createPcmBlob(downsampledData);
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
            stopSession(false); 
          },
          onerror: (err) => {
            console.error("Session Error", err);
            setError("Conexión perdida. Intenta de nuevo.");
            errorRecoveryRef.current = true; // Mark that we hit an error
            stopSession(true); 
          }
        }
      });
      
      sessionPromise.catch(err => {
        console.error("Connection Failed", err);
        setError("No se pudo conectar. Verifica tu micrófono.");
        errorRecoveryRef.current = true;
        stopSession(true); 
      });

      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setError("Error al iniciar la clase.");
      errorRecoveryRef.current = true;
      stopSession(true); 
    }
  };

  useEffect(() => {
    return () => {
      stopSession(false);
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
            <div className="relative">
                 <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-700 rounded-full"></div>
                 <div className="absolute top-0 left-0 w-16 h-16 border-4 border-brand-500 dark:border-brand-400 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Preparando tu lección...</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm">Personalizando la experiencia para ti.</p>
            </div>
        </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white relative transition-colors duration-300">
      
      {/* --- HEADER (DYNAMIC) --- */}
      <div className={`flex-shrink-0 flex flex-col items-center justify-center p-6 pt-10 transition-all duration-500 ${connected ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700' : ''}`}>
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-300 px-6 py-3 rounded-2xl max-w-sm text-center mb-6 text-sm font-bold shadow-sm animate-in fade-in slide-in-from-top-4">
            {error}
          </div>
        )}
        
        {connected ? (
          <div className="w-full max-w-lg mx-auto">
             <Visualizer state={visState} />
             <div className="text-center mt-6">
               <span className="inline-block px-3 py-1 rounded-full bg-brand-100 dark:bg-brand-900/50 border border-brand-200 dark:border-brand-500/30 text-brand-700 dark:text-brand-300 text-[10px] font-bold uppercase tracking-wider mb-2">
                 {activeScenario?.title}
               </span>
               <p className="text-slate-500 dark:text-slate-300 text-sm font-medium animate-pulse">
                 {visState === 'speaking' ? 'Escuchando...' : 'Tu turno de hablar...'}
               </p>
             </div>
          </div>
        ) : (
           /* HEADER FOR MENUS */
           <div className="text-center space-y-2 relative w-full max-w-lg mx-auto">
             {step === 'SCENARIOS' && (
                 <button onClick={() => setStep('MENU')} className="absolute -top-4 left-0 text-slate-400 hover:text-brand-600 dark:hover:text-white flex items-center gap-1 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg px-2">
                     ← Ajustes
                 </button>
             )}
             {step === 'PREP' && (
                 <button onClick={() => setStep('SCENARIOS')} className="absolute -top-4 left-0 text-slate-400 hover:text-brand-600 dark:hover:text-white flex items-center gap-1 text-sm font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500 rounded-lg px-2">
                     ← Temas
                 </button>
             )}
             
             {step === 'MENU' && (
               <div className="pb-2">
                 <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">Configura tu Clase</h2>
                 <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Personaliza tu experiencia de aprendizaje.</p>
               </div>
             )}
             
             {(step === 'SCENARIOS' || step === 'PREP') && (
               <div className="flex flex-col items-center animate-in fade-in zoom-in duration-300">
                 <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white dark:bg-slate-800 shadow-lg mb-3 border border-slate-100 dark:border-slate-600">
                    <span className="text-3xl">{selectedTopic ? selectedTopic.icon : '👋'}</span>
                 </div>
                 <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-white">
                     {selectedTopic?.label}
                 </h2>
               </div>
             )}
           </div>
        )}
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white relative transition-colors duration-300 scroll-smooth">
        
        {!connected ? (
           <div className="p-6 space-y-6 pb-28 max-w-lg mx-auto min-h-full">
              
              {/* VIEW 1: TOPIC MENU */}
              {step === 'MENU' && (
                  <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
                    
                    {/* DASHBOARD CARD 1: PREFERENCES */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-600 shadow-sm">
                        <div className="flex items-center gap-3 mb-6 border-b border-slate-100 dark:border-slate-700 pb-4">
                            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-sm shadow-sm">1</div>
                            <h3 className="font-bold text-slate-800 dark:text-white text-lg">Preferencias</h3>
                        </div>
                        
                        <div className="space-y-6">
                            {/* Voice Control - Segmented */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Voz del Tutor</label>
                                <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl flex relative border border-slate-200 dark:border-slate-700">
                                    <button 
                                        onClick={() => setVoiceGender('male')}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                            voiceGender === 'male' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md transform scale-[1.02]' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        👨 Masculino
                                    </button>
                                    <button 
                                        onClick={() => setVoiceGender('female')}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                            voiceGender === 'female' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md transform scale-[1.02]' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        👩 Femenino
                                    </button>
                                </div>
                            </div>

                            {/* Accent Control - Restored */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Acento</label>
                                <div className="bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl flex relative border border-slate-200 dark:border-slate-700">
                                    <button 
                                        onClick={() => setVoiceAccent('US')}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                            voiceAccent === 'US' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md transform scale-[1.02]' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        🇺🇸 USA
                                    </button>
                                    <button 
                                        onClick={() => setVoiceAccent('UK')}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all relative z-10 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                            voiceAccent === 'UK' 
                                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-md transform scale-[1.02]' 
                                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                        }`}
                                    >
                                        🇬🇧 UK
                                    </button>
                                </div>
                            </div>

                            {/* Level Control - Cards */}
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Nivel</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                    onClick={() => setActiveTab('PRE_A1')}
                                    className={`py-4 px-3 rounded-2xl text-sm font-bold transition-all duration-200 border-2 flex flex-col items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                        activeTab === 'PRE_A1'
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-md transform scale-[1.02]'
                                        : 'border-transparent bg-slate-50 dark:bg-slate-700/50 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                    >
                                        <span className="text-2xl filter drop-shadow-sm">🌱</span>
                                        Principiante
                                    </button>
                                    <button
                                    onClick={() => setActiveTab('A1')}
                                    className={`py-4 px-3 rounded-2xl text-sm font-bold transition-all duration-200 border-2 flex flex-col items-center gap-2 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                        activeTab === 'A1'
                                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-md transform scale-[1.02]'
                                        : 'border-transparent bg-slate-50 dark:bg-slate-700/50 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                    >
                                        <span className="text-2xl filter drop-shadow-sm">🚀</span>
                                        Básico
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 2: TOPICS GRID */}
                    <div>
                        <div className="flex items-center gap-3 mb-4 px-2">
                             <div className="w-8 h-8 rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center font-bold text-sm shadow-sm">2</div>
                             <h3 className="font-bold text-slate-800 dark:text-white text-lg">Elige un Tema</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {currentTopics.map((topic) => {
                              const isDone = isCompleted(topic.id);
                              return (
                                <button
                                      key={topic.id}
                                      onClick={() => fetchScenarios(topic)}
                                      disabled={isLoadingScenarios}
                                      className={`relative bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 p-6 rounded-3xl flex flex-col items-center justify-center gap-4 transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 group border border-transparent dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 ${
                                        isDone 
                                          ? 'shadow-brand-500/10 border-brand-500/30 dark:border-brand-500/30 ring-1 ring-brand-500/20' 
                                          : ''
                                      }`}
                                  >
                                      {isDone && (
                                        <div className="absolute top-3 right-3 bg-brand-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                            ✓
                                        </div>
                                      )}
                                      <div className="w-16 h-16 rounded-full bg-slate-50 dark:bg-slate-700 flex items-center justify-center text-3xl group-hover:scale-110 transition-transform duration-300 shadow-inner">
                                        {topic.icon}
                                      </div>
                                      <span className="font-bold text-slate-700 dark:text-slate-200 text-sm group-hover:text-brand-600 dark:group-hover:text-brand-400">{topic.label}</span>
                                  </button>
                            )})}
                        </div>
                    </div>
                  </div>
              )}

              {/* VIEW 2: SCENARIO SELECTION */}
              {step === 'SCENARIOS' && (
                  <div className="space-y-4 animate-in slide-in-from-right-8 fade-in duration-300">
                      <div className="px-1 mb-2">
                          <p className="text-slate-500 dark:text-slate-400 text-sm">Selecciona una situación para practicar:</p>
                      </div>
                      {generatedScenarios.map((scen, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleScenarioSelect(scen)}
                            disabled={isConnecting}
                            className={`w-full text-left bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-l-[6px] border-y border-r p-6 rounded-r-3xl rounded-l-md transition-all shadow-md hover:shadow-xl group relative overflow-hidden active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed ${
                                activeScenario === scen 
                                ? 'border-l-brand-500 border-brand-200 dark:border-slate-600 ring-2 ring-brand-500/20'
                                : 'border-l-brand-500 border-slate-100 dark:border-slate-600'
                            }`}
                          >
                             <div className="relative z-10">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">{scen.title}</span>
                                    <span className="bg-slate-100 dark:bg-slate-700 text-slate-400 group-hover:bg-brand-500 group-hover:text-white p-2 rounded-full transition-all duration-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
                                    </span>
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed pr-8">{scen.description}</p>
                             </div>
                          </button>
                      ))}
                      <button onClick={() => fetchScenarios(selectedTopic!)} className="w-full py-4 text-sm font-bold text-slate-400 hover:text-brand-600 dark:hover:text-brand-400 border border-dashed border-slate-300 dark:border-slate-600 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors mt-4 focus:outline-none focus:ring-2 focus:ring-slate-400">
                          ↻ Generar nuevas situaciones
                      </button>
                  </div>
              )}

              {/* VIEW 3: WARM-UP / PREP */}
              {step === 'PREP' && activeScenario && (
                  <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
                      <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-8 rounded-[2rem] text-white shadow-xl text-center relative overflow-hidden group border border-brand-500">
                          <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-10 rounded-full translate-x-10 translate-y-[-10] blur-xl group-hover:scale-110 transition-transform duration-700"></div>
                          <div className="relative z-10">
                              <h3 className="text-2xl font-black mb-2 tracking-tight">¡Prepárate!</h3>
                              <p className="text-brand-100 text-sm font-medium">Practica estas palabras antes de empezar la llamada.</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                          {activeScenario.vocabulary?.map((item, idx) => (
                              <button
                                key={idx}
                                onClick={() => playWordAudio(item.word)}
                                disabled={audioPlaying !== null}
                                className={`relative overflow-hidden flex flex-col p-5 rounded-2xl border transition-all shadow-sm hover:shadow-md active:scale-95 text-left h-full focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-70 disabled:cursor-wait ${
                                    audioPlaying === item.word
                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 ring-2 ring-brand-500/20'
                                    : 'border-slate-100 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-brand-200 dark:hover:border-brand-500'
                                }`}
                              >
                                  <div className="flex justify-between items-start mb-2">
                                     <span className="text-lg font-black text-slate-800 dark:text-white leading-tight">{item.word}</span>
                                     <div className={`p-1.5 rounded-full flex-shrink-0 ${audioPlaying === item.word ? 'bg-brand-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                                        {audioPlaying === item.word ? (
                                            <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                                        ) : (
                                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>
                                        )}
                                     </div>
                                  </div>
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-bold mt-auto">{item.translation}</span>
                              </button>
                          ))}
                      </div>

                      <div className="pt-6 sticky bottom-4 z-20">
                          <button
                            onClick={startSession}
                            disabled={isConnecting}
                            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-5 rounded-full font-bold text-xl shadow-2xl flex items-center justify-center gap-3 transition-all active:scale-95 hover:scale-[1.02] hover:shadow-slate-900/20 dark:hover:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 focus:outline-none focus:ring-4 focus:ring-brand-500/50"
                          >
                             {isConnecting ? (
                               <>
                                 <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
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
            className="h-full overflow-y-auto px-4 py-4 space-y-6 mask-image-gradient scroll-smooth pb-32"
          >
            {transcript.length === 0 && (
              <div className="flex flex-col items-center justify-center mt-32 opacity-40 space-y-6 animate-pulse">
                  <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700"></div>
                  <p className="text-sm font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Escuchando...</p>
              </div>
            )}
            {transcript.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
                    <div className={`max-w-[85%] rounded-2xl px-5 py-4 text-[15px] leading-relaxed shadow-sm ${
                        msg.role === 'user' 
                        ? 'bg-brand-600 text-white rounded-tr-sm shadow-md border border-brand-700' 
                        : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border-2 border-slate-100 dark:border-slate-600 rounded-tl-sm'
                    }`}>
                        {msg.text}
                    </div>
                </div>
            ))}
            <div ref={transcriptEndRef} className="h-8" />
          </div>
        )}

        {/* Floating Stop Button (Only when connected) */}
        {connected && (
           <div className="absolute bottom-8 left-0 right-0 flex justify-center z-30 pointer-events-none">
             <button
               onClick={finishSession}
               className="pointer-events-auto bg-red-500/90 backdrop-blur-md hover:bg-red-600 text-white pl-6 pr-8 py-3.5 rounded-full font-bold shadow-xl shadow-red-500/30 flex items-center gap-3 hover:scale-105 transition-transform border border-red-400/50 group focus:outline-none focus:ring-4 focus:ring-red-500/40"
             >
               <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
               </span>
               Terminar Clase (+{POINTS.live} XP)
             </button>
           </div>
        )}
      </div>
    </div>
  );
};
