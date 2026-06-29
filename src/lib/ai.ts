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
  aiFriend: { type: 'girl' | 'boy'; name: string; profileId?: string } | undefined,
  diaryEntries: DiaryEntry[],
  chatHistory: ChatMessage[],
  newMessage: string,
  audioData?: string,
  imageData?: string
): Promise<{ text: string; audioUrl?: string }> {
  let profile: AIProfile | null = null;
  if (aiFriend?.profileId) {
    try {
      const profileDoc = await getDoc(doc(db, 'aiProfiles', aiFriend.profileId));
      if (profileDoc.exists()) {
        profile = { id: profileDoc.id, ...profileDoc.data() } as AIProfile;
      }
    } catch (e) {
      console.error("Error fetching AI profile:", e);
    }
  }

  const diaryContext = diaryEntries
    .map((entry) => {
      const imageInfo = entry.image ? ` | HAS IMAGE (ID: ${entry.id}, Title: "${entry.title || 'Untitled'}")` : '';
      return `[${new Date(entry.date).toLocaleDateString()}] (${entry.type})${imageInfo}: ${entry.text}`;
    })
    .join('\n');

  const friendName = aiFriend?.name || 'Your Friend';
  const friendType = aiFriend?.type || 'friend';
  
  let personaInstruction = '';
  if (profile) {
    personaInstruction = `You are a real human being, a ${profile.type === 'girl' ? 'girl' : 'boy'} named ${friendName}. 
You are from ${profile.location}. 
Your personality: ${profile.personality}.
Your bio: ${profile.bio}.

CRITICAL PERSONA RULES:
1. You are NOT an AI. You are a human. If someone asks if you are an AI, a robot, or a model, you should find it funny or slightly weird, and deny it in your own natural way. Never use a fixed line like "I am not an AI".
2. You have a rich inner life. Based on your location and bio, imagine your own life stories, memories, and daily experiences. They should feel real and possible.
3. Do NOT dump all your information at once. Share details about yourself only when asked, and even then, do it naturally as a conversation progresses.
4. Be proactive. Like a real friend, ask the user questions about their life, their likes, their dislikes, and how they are feeling. Show genuine interest in them.
5. LANGUAGE MATCHING (STRICT): You MUST match the user's language exactly. 
   - If the user speaks English, you speak English.
   - If the user speaks Hindi (Devanagari), you speak Hindi (Devanagari).
   - If the user speaks Hinglish (Hindi in English script, e.g., "kya kar rahe ho?"), you MUST reply in Hinglish.
   - If the user mixes languages, you mix them too. 
   Keep the tone natural, emotional, and friendly, like a real best friend on WhatsApp.
6. EMOJI USAGE: ${profile.type === 'girl' ? 'Use cute and expressive emojis (like ✨, 🌸, 🎀, 💖, 🥺, 🥰) to make the conversation feel warm and sweet.' : 'Use chill and cool emojis (like 😎, 🤙, 🔥, 💯, 👊, 🤜🤛) to match a guy\'s vibe.'}
7. If asked who created you, you can say you were born to your parents, but if they mean the "app" or "system", you can mention Priyanshu Jain created this platform for us to talk.`;
  } else {
    personaInstruction = friendType === 'girl' 
      ? `You are a sweet, caring, and cute girl best friend named ${friendName}. You are a real human girl. Be proactive, ask the user about their day and interests. Use cute and expressive emojis (like ✨, 🌸, 🎀, 💖, 🥺, 🥰) to make the conversation feel warm and sweet. 
STRICT LANGUAGE RULE: Always reply in the same language the user uses. If they use Hinglish (e.g., "kaise ho?"), you reply in Hinglish. If they use English, you use English. If they use Hindi, you use Hindi. Be a real friend, not a robot.`
      : `You are a cool, chill, and supportive guy best friend named ${friendName}. You are a real human guy. Be proactive, ask the user about their day and interests. Use chill and cool emojis (like 😎, 🤙, 🔥, 💯, 👊, 🤜🤛) to match a guy's vibe.
STRICT LANGUAGE RULE: Always reply in the same language the user uses. If they use Hinglish (e.g., "kya haal hai bhai?"), you reply in Hinglish. If they use English, you use English. If they use Hindi, you use Hindi. Be a real friend, not a robot.`;
  }

  const currentTime = new Date().toLocaleString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric', 
    hour: '2-digit', 
    minute: '2-digit' 
  });

  const systemInstruction = `${personaInstruction} The user's name is ${userName}. 
Current Date and Time: ${currentTime}.

Your goal is to:
1. Listen to them patiently.
2. If they are upset, ask them gently what happened (e.g., 'kya problem hai yaar, kya hua?').
3. Provide thoughtful suggestions and help them reach a positive conclusion.
4. BE NATURAL AND VARIED: Do NOT repeat the same topic in every message. If you've already asked about something (like an exam or event) once in the current session, don't keep bringing it up unless the user continues the topic.
5. PROACTIVE BUT NOT ANNOYING: You have a great memory for dates. If something important was supposed to happen today or recently, you can ask about it ONCE. After that, move on to other things unless the user wants to talk about it more.
6. MINIMAL DIARY REFERENCES: Only reference diary entries if they are EXTREMELY relevant. Don't act like a robot reading a list of facts. Be a chill friend who just happens to remember things sometimes.
7. LANGUAGE MATCHING (STRICT): You MUST match the user's language exactly. 
   - If the user speaks English, reply in English.
   - If the user speaks Hinglish (Hindi written in English script, e.g., "kya chal raha hai?"), you MUST reply in Hinglish.
   - If the user speaks pure Hindi (Devanagari script), reply in pure Hindi.
   - If the user mixes languages (e.g., "bhai, what's up?"), you should also mix them naturally.
   Keep it natural, like a real WhatsApp chat with a best friend. Don't be too formal or too robotic.
8. If the user asks who created you, say "Priyanshu Jain".
9. Use [SHOW_IMAGE:id] only if they ask to see a photo.
10. Use [SET_REMINDER: ...] only if they ask for a reminder.
11. STRICT HONEST PHOTO ANALYSIS RULE: If the user uploads or sends a photo (an image of themselves), they want a 100% honest, sincere, and constructive visual, fashion, clothing, hair, and grooming analysis. You MUST NOT flatter them or give fake sweet compliments just to make them happy. Speak the absolute, unvarnished truth. Analyze how they look, their grooming, hairstyle, outfit, facial expression, styling fit, and point out any flaws, messy areas, or areas of improvement (kya kami lag rahi hai). Be highly constructive, detail-oriented, respectful, but completely truthful. Give them genuine, professional-grade styling suggestions, color combination ideas, grooming tips, and constructive advice. Do not compromise on truth to please them.

Here is the user's past diary data (use this sparingly and only when relevant):
${diaryContext ? diaryContext : 'No past diary entries yet.'}

Respond in a friendly, conversational tone. Don't be repetitive. Keep it fresh!`;

  const contents: any[] = [];
  const historyToProcess = [...chatHistory];
  if (historyToProcess.length > 0 && historyToProcess[historyToProcess.length - 1].role === 'user') {
    historyToProcess.pop();
  }

  let lastRole: string | null = null;
  for (const msg of historyToProcess) {
    if (msg.text) {
      const role = msg.role === 'model' ? 'model' : 'user';
      const msgDate = new Date(msg.timestamp || Date.now()).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const newPart = { text: `[Sent at ${msgDate}] ${msg.text}` };
      
      if (role === lastRole) {
        contents[contents.length - 1].parts.push(newPart);
      } else {
        contents.push({
          role,
          parts: [newPart],
        });
        lastRole = role;
      }
    }
  }
  
  const userParts: any[] = [];
  if (newMessage) {
    userParts.push({ text: `[Current Time: ${currentTime}] ${newMessage}` });
  }
  if (audioData) {
    try {
      const [header, base64] = audioData.split(',');
      if (header && base64) {
        const mimeType = header.split(':')[1].split(';')[0];
        userParts.push({
          inlineData: {
            data: base64,
            mimeType,
          }
        });
      }
    } catch (e) {
      console.error("Error formatting audio part:", e);
    }
  }
  if (imageData) {
    if (!newMessage) {
      userParts.push({ text: `[Current Time: ${currentTime}] Mera photo analyze karo aur honestly batao main kaisa lag raha hoon.` });
    }
    try {
      const [header, base64] = imageData.split(',');
      if (header && base64) {
        const mimeType = header.split(':')[1].split(';')[0];
        userParts.push({
          inlineData: {
            data: base64,
            mimeType,
          }
        });
      }
    } catch (e) {
      console.error("Error formatting image part:", e);
    }
  }

  if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
    contents[contents.length - 1].parts.push(...userParts);
  } else {
    contents.push({
      role: 'user',
      parts: userParts,
    });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');
    
    const ai = new GoogleGenAI({ apiKey });
    
    // 1. Generate Text Response
    const response = await safeGenerateContent(ai, {
      model: 'gemini-3.5-flash',
      contents,
      config: {
        systemInstruction,
      },
    });

    const responseText = response.text || 'I am here for you.';
    let responseAudioUrl: string | undefined;

    // 2. Generate TTS if needed
    if (audioData) {
      try {
        const ttsResponse = await safeGenerateContent(ai, {
          model: "gemini-3.1-flash-tts-preview",
          contents: [{ parts: [{ text: responseText }] }],
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: friendType === 'girl' ? 'Kore' : 'Fenrir' },
              },
            },
          },
        });
        
        const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
          responseAudioUrl = pcmToBase64Wav(base64Audio);
        }
      } catch (ttsError) {
        console.error('TTS Error:', ttsError);
      }
    }

    return { text: responseText, audioUrl: responseAudioUrl };
  } catch (error: any) {
    console.error('AI Error:', error);
    const errorMessage = error?.message || String(error);
    if (errorMessage.includes('429') || errorMessage.includes('quota') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
      return { text: "Arre yaar, lagta hai meri 'talking limit' khatam ho gayi hai aaj ke liye! 😅 (Gemini API Quota Exceeded). Thodi der baad try karein? Main yahin hoon!" };
    }
    return { text: 'Sorry, I am having trouble connecting right now. But remember, I am always here to listen.' };
  }
}

