import { getGeminiClient } from '../services/geminiService';
import { Modality, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { decodeAudioData } from './audioUtils';

// Singleton AudioContext to prevent browser limit errors and reduce latency
let sharedAudioContext: AudioContext | null = null;

// Cache to store downloaded audio buffers: "VoiceName:Text" -> AudioBuffer
const audioCache = new Map<string, AudioBuffer>();

const getAudioContext = (): AudioContext => {
  if (!sharedAudioContext) {
    // Initialize with 24kHz which is the standard Gemini output
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    sharedAudioContext = new AudioContextClass({ sampleRate: 24000 });
  }
  return sharedAudioContext;
};

export const playTTS = async (text: string, voiceName: string = 'Kore'): Promise<void> => {
  if (!text || !text.trim()) return;

  const ctx = getAudioContext();
  
  // Browsers (especially Chrome/Safari) suspend AudioContext if created without user gesture.
  // We ensure it is running before trying to play.
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }

  const cacheKey = `${voiceName}:${text.trim()}`;

  // 1. Check Cache
  if (audioCache.has(cacheKey)) {
    await playBuffer(ctx, audioCache.get(cacheKey)!);
    return;
  }

  // 2. Fetch from API if not in cache
  let retries = 3;
  while (retries > 0) {
    try {
        const ai = getGeminiClient();
        
        // Remove systemInstruction as it can cause 500 Internal Error on the specific TTS model endpoint.
        // Instead, use prompt engineering (Prefixing with "Say:") to force the model to behave as a TTS engine
        // and avoid interpreting commands like "Help me" or "Repeat" as conversational turns.
        const ttsPrompt = `Say: ${text.trim()}`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: ttsPrompt }] }],
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName },
                  },
              },
              // CRITICAL: Survival phrases like "Help me" or "I am sick" can trigger safety blocks.
              // We must relax these settings for a TTS task.
              safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
              ],
            },
        });

        // Robust check for response validity
        if (!response.candidates || response.candidates.length === 0) {
            if (response.promptFeedback?.blockReason) {
                console.warn("TTS Blocked:", response.promptFeedback.blockReason);
                throw new Error(`TTS Blocked: ${response.promptFeedback.blockReason}`);
            }
            throw new Error("No candidates returned from TTS model");
        }

        const part = response.candidates[0].content?.parts?.[0];
        
        // Check for text refusal specifically. 
        if (part?.text && !part?.inlineData) {
             console.warn(`TTS Model Refusal: ${part.text}`);
             throw new Error(`TTS_REFUSAL: ${part.text}`);
        }

        const base64Audio = part?.inlineData?.data;
        if (!base64Audio) {
            throw new Error("No audio returned in response");
        }

        // 3. Decode and Cache
        const audioBuffer = await decodeAudioData(base64Audio, ctx);
        audioCache.set(cacheKey, audioBuffer);

        // 4. Play
        await playBuffer(ctx, audioBuffer);
        return;

    } catch (e: any) {
        console.error("TTS Attempt failed:", e.message);
        
        // Don't retry if it was a refusal or block, it likely won't change
        if (e.message && (e.message.startsWith("TTS_REFUSAL") || e.message.includes("Blocked"))) {
             throw e;
        }

        retries--;
        if (retries === 0) {
            throw e;
        }
        // Exponential backoff
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, 3 - retries)));
    }
  }
};

// Helper to play an existing buffer
const playBuffer = (ctx: AudioContext, buffer: AudioBuffer): Promise<void> => {
  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start();
  });
};