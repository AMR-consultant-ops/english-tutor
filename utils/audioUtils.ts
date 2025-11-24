export const PCM_SAMPLE_RATE = 16000;
export const AUDIO_PLAYBACK_RATE = 24000; // Gemini 2.5 usually outputs 24kHz

export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function decodeAudioData(
  base64Data: string,
  ctx: AudioContext
): Promise<AudioBuffer> {
  const bytes = base64ToUint8Array(base64Data);
  const dataInt16 = new Int16Array(bytes.buffer);
  
  // Gemini 2.5 Live API returns mono 24kHz (usually) or configured rate
  const numChannels = 1;
  const frameCount = dataInt16.length;
  
  const buffer = ctx.createBuffer(numChannels, frameCount, AUDIO_PLAYBACK_RATE);
  const channelData = buffer.getChannelData(0);
  
  for (let i = 0; i < frameCount; i++) {
    // Convert Int16 to Float32 [-1.0, 1.0]
    channelData[i] = dataInt16[i] / 32768.0;
  }
  
  return buffer;
}

/**
 * Downsamples audio data from the source rate to the target rate (16kHz).
 * Simple linear interpolation.
 */
export function downsampleTo16k(inputData: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === PCM_SAMPLE_RATE) {
    return inputData;
  }

  const ratio = inputSampleRate / PCM_SAMPLE_RATE;
  const newLength = Math.ceil(inputData.length / ratio);
  const result = new Float32Array(newLength);
  
  for (let i = 0; i < newLength; i++) {
    const originalIndex = i * ratio;
    const index1 = Math.floor(originalIndex);
    const index2 = Math.min(Math.ceil(originalIndex), inputData.length - 1);
    const weight = originalIndex - index1;
    
    // Linear interpolation
    result[i] = inputData[index1] * (1 - weight) + inputData[index2] * weight;
  }
  
  return result;
}

export function createPcmBlob(data: Float32Array): { data: string; mimeType: string } {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    // Clamp values [-1.0, 1.0] and convert to Int16 PCM
    let s = Math.max(-1, Math.min(1, data[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  return {
    data: arrayBufferToBase64(int16.buffer),
    mimeType: `audio/pcm;rate=${PCM_SAMPLE_RATE}`,
  };
}
