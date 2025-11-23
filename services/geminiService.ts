import { GoogleGenAI } from "@google/genai";

export const getGeminiClient = () => {
  let apiKey: string | undefined;

  // 1. Try standard process.env (Node/Webpack/Polyfilled environments)
  try {
    // Check if process is defined to avoid ReferenceError in strict browser environments like Netlify
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.API_KEY;
    }
  } catch (e) {
    // Ignore ReferenceError if process is not defined
  }

  // 2. Try Vite standard import.meta.env (Netlify + Vite default behavior)
  if (!apiKey) {
    try {
      // @ts-ignore: Suppress TS error for import.meta in environments that don't recognize it
      // We check VITE_API_KEY (standard Vite) and API_KEY (fallback)
      apiKey = import.meta.env?.VITE_API_KEY || import.meta.env?.API_KEY;
    } catch (e) {
      // Ignore if import.meta is not available
    }
  }
  
  if (!apiKey) {
    // If you are seeing this error, ensure your environment injects the API_KEY correctly.
    // On Netlify, set 'VITE_API_KEY' in Site Settings > Environment Variables.
    console.error("API Key not found. Please set VITE_API_KEY or API_KEY in your environment.");
    throw new Error("API Key not found in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};