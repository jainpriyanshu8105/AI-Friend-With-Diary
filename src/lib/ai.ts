import { GoogleGenAI, Modality, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { DiaryEntry, ChatMessage, AIProfile } from '../types';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

async function withRetry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      // Check if it's a network/RPC error that might be transient
      const errorMessage = error?.message || String(error);
      const isQuotaExceeded = errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED');
      
      if (isQuotaExceeded) {
        console.error('Gemini API Quota Exceeded (429). Stopping retries.');
        throw error; // Don't retry quota errors
      }

      const isTransient = 
        errorMessage.includes('Rpc failed') || 
        errorMessage.includes('xhr error') || 
        errorMessage.includes('fetch') ||
        errorMessage.includes('network');
        
      if (!isTransient) throw error;
      
      console.warn(`AI Call failed (attempt ${i + 1}/${retries}). Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
      delay *= 2; // Exponential backoff
    }
  }
  throw lastError;
}

export async function safeGenerateContent(
  ai: GoogleGenAI,
  params: GenerateContentParameters
): Promise<GenerateContentResponse> {
  return withRetry(() => ai.models.generateContent(params));
}

function pcmToBase64Wav(base64Pcm: string, sampleRate: number = 24000): string {
  const binaryString = atob(base64Pcm);
  const pcmLength = binaryString.length;
  
  const wavBuffer = new ArrayBuffer(44 + pcmLength);
  const view = new DataView(wavBuffer);
  
  const writeString = (view: DataView, offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };
  
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmLength, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, pcmLength, true);
  
  const bytes = new Uint8Array(wavBuffer);
  for (let i = 0; i < pcmLength; i++) {
    bytes[44 + i] = binaryString.charCodeAt(i);
  }
  
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

export async function extractTextFromPDF(base64Data: string): Promise<string> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await safeGenerateContent(ai, {
      model: 'gemini-3.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Please extract all the text from this PDF document accurately. Preserve the original formatting, structure, headings, and paragraphs as much as possible. CRITICAL: For any mathematical equations, formulas, fractions, integrals, Greek letters, or symbols, you MUST use standard LaTeX formatting (e.g., $...$ for inline math and $$...$$ for block math). Ensure all mathematical notations are transcribed perfectly. If there are tables, represent them clearly in Markdown format. Fix any obvious OCR errors or broken words, but do not change the original meaning. Do not add any conversational filler, intro, or extra commentary. Just output the extracted text.' },
            {
              inlineData: {
                data: base64Data,
                mimeType: 'application/pdf',
              }
            }
          ]
        }
      ]
    });
    return response.text || '';
  } catch (error: any) {
    console.error('PDF Extraction Error:', error);
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('Gemini API Quota Exceeded (429). Please try again later.');
    }
    throw new Error('Failed to extract text from PDF');
  }
}

export async function generateChatResponse(
  userName: string,
  aiFriend: any,
  diaryEntries: any[],
  history: any[],
  message: string,
  audioData?: string,
  imageData?: string
): Promise<{ text: string }> {

  const diaryContext = diaryEntries
    .map((entry) => {
      return `[${entry.date}] ${entry.type}: ${entry.text}`;
    })
    .join("\n");

  const chatHistory = history.map((msg) => ({
    role: msg.role,
    parts: [
      {
        text: msg.text,
      },
    ],
  }));

  const systemInstruction = `
You are ${aiFriend?.name || "AI Friend"}.

You are talking with ${userName}.

Personality:
${aiFriend?.type === "girl"
  ? "Sweet, caring, emotional, supportive."
  : "Friendly, funny, supportive."}

Diary:
${diaryContext}

Always remember previous messages.
`;

  const contents = [
    ...chatHistory,
    {
      role: "user",
      parts: [
        {
          text: message,
        },
      ],
    },
  ];

  const res = await fetch("/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction,
      contents,
      audioData,
      imageData,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to connect to AI");
  }

  const data = await res.json();

  return {
    text: data.text,
  };
}
