import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Sparkles, RefreshCcw, Wind, Stars, Brain, Trophy, Timer, Upload, ImageIcon, Loader2, Download, Send, User, Bot } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { safeGenerateContent } from '../lib/ai';

import { WatermelonSlicer } from './WatermelonSlicer';

interface GamesProps {
  onBack: () => void;
}

type GameType = 'funny' | 'memory' | 'zen' | 'watermelon' | null;

export function Games({ onBack }: GamesProps) {
  const [activeGame, setActiveGame] = useState<GameType>(null);

  // If zen or watermelon is active, we want a full screen experience
  if (activeGame === 'zen' || activeGame === 'watermelon') {
    return (
      <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col">
        {activeGame === 'zen' && (
          <div className="p-4 flex items-center justify-between border-b border-white/10 bg-slate-900/50 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setActiveGame(null)} 
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-white" />
              </button>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                Zen Garden Full Screen
                <Wind className="w-5 h-5 text-emerald-400" />
              </h1>
            </div>
            <p className="text-white/40 text-sm hidden md:block uppercase tracking-widest">Draw slowly and breathe...</p>
          </div>
        )}
        <div className="flex-1 relative">
          {activeGame === 'zen' ? (
            <ZenGarden isFullScreen />
          ) : (
            <WatermelonSlicer onBack={() => setActiveGame(null)} />
          )}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto w-full min-h-[85vh] flex flex-col p-4"
    >
      <div className="flex items-center mb-8">
        <button 
          onClick={activeGame ? () => setActiveGame(null) : onBack} 
          className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors mr-4"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          {activeGame === 'funny' ? 'Try Something Funny' : activeGame === 'memory' ? 'Memory Match' : activeGame === 'watermelon' ? 'Tarbooz Slicer' : 'Stress Buster Games'}
          <Sparkles className="w-6 h-6 text-orange-400" />
        </h1>
      </div>

      {!activeGame ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
          <button
            onClick={() => setActiveGame('funny')}
            className="group bg-gradient-to-br from-orange-500/20 to-yellow-500/20 border border-white/10 p-8 rounded-3xl text-left hover:scale-[1.02] transition-all"
          >
            <div className="bg-orange-500/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <ImageIcon className="w-8 h-8 text-orange-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Try Something Funny</h2>
            <p className="text-orange-200 text-sm">Upload your photo and see yourself magically transformed into a cute baby, a funny bear, a baby monkey and more, while preserving your actual face! Interactive fun and laughter guaranteed.</p>
          </button>

          <button
            onClick={() => setActiveGame('zen')}
            className="group bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-white/10 p-8 rounded-3xl text-left hover:scale-[1.02] transition-all"
          >
            <div className="bg-emerald-500/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Wind className="w-8 h-8 text-emerald-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Zen Garden</h2>
            <p className="text-emerald-200 text-sm">Draw patterns in the sand and relax your mind. Now in full screen for maximum peace.</p>
          </button>

          <button
            onClick={() => setActiveGame('memory')}
            className="group bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-white/10 p-8 rounded-3xl text-left hover:scale-[1.02] transition-all"
          >
            <div className="bg-purple-500/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Brain className="w-8 h-8 text-purple-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Memory Match</h2>
            <p className="text-purple-200 text-sm">Match pairs of cards as fast as you can. Challenge your brain and beat your high score!</p>
          </button>

          <button
            onClick={() => setActiveGame('watermelon')}
            className="group bg-gradient-to-br from-red-500/20 to-green-500/20 border border-white/10 p-8 rounded-3xl text-left hover:scale-[1.02] transition-all"
          >
            <div className="bg-red-500/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <span className="text-4xl">🍉</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Tarbooz Slicer</h2>
            <p className="text-red-200 text-sm">Slice falling watermelons as fast as you can! 30 seconds of pure fun and high scores.</p>
          </button>
        </div>
      ) : (
        <div className="flex-1 bg-white/5 border border-white/10 rounded-3xl overflow-hidden relative backdrop-blur-xl min-h-[650px]">
          {activeGame === 'funny' && <FunnyBabyCreator />}
          {activeGame === 'memory' && <MemoryMatch />}
        </div>
      )}



    </motion.div>
  );
}

function MemoryMatch() {
  const icons = ['🌟', '🍎', '🌈', '🐱', '🍕', '🎸', '🚀', '🍦'];
  const [cards, setCards] = useState<{ id: number; icon: string; flipped: boolean; matched: boolean }[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [timer, setTimer] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [highScore, setHighScore] = useState<number | null>(null);
  const [gameWon, setGameWon] = useState(false);

  useEffect(() => {
    const savedScore = localStorage.getItem('memory_match_highscore');
    if (savedScore) setHighScore(parseInt(savedScore));
    initGame();
  }, []);

  useEffect(() => {
    let interval: any;
    if (isActive && !gameWon) {
      interval = setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, gameWon]);

  const initGame = () => {
    const shuffled = [...icons, ...icons]
      .sort(() => Math.random() - 0.5)
      .map((icon, index) => ({
        id: index,
        icon,
        flipped: false,
        matched: false,
      }));
    setCards(shuffled);
    setFlippedIndices([]);
    setTimer(0);
    setIsActive(false);
    setGameWon(false);
  };

  const handleFlip = (index: number) => {
    if (!isActive) setIsActive(true);
    if (flippedIndices.length === 2 || cards[index].flipped || cards[index].matched) return;

    const newCards = [...cards];
    newCards[index].flipped = true;
    setCards(newCards);

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    if (newFlipped.length === 2) {
      const [first, second] = newFlipped;
      if (cards[first].icon === cards[second].icon) {
        newCards[first].matched = true;
        newCards[second].matched = true;
        setCards(newCards);
        setFlippedIndices([]);
        
        if (newCards.every(c => c.matched)) {
          setGameWon(true);
          checkHighScore(timer);
        }
      } else {
        setTimeout(() => {
          newCards[first].flipped = false;
          newCards[second].flipped = false;
          setCards(newCards);
          setFlippedIndices([]);
        }, 1000);
      }
    }
  };

  const checkHighScore = (score: number) => {
    if (!highScore || score < highScore) {
      setHighScore(score);
      localStorage.setItem('memory_match_highscore', score.toString());
    }
  };

  return (
    <div className="w-full h-full absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-900/50">
      <div className="flex gap-8 mb-8">
        <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
          <Timer className="w-5 h-5 text-indigo-400" />
          <span className="text-2xl font-mono text-white">{timer}s</span>
        </div>
        {highScore && (
          <div className="flex items-center gap-2 bg-white/5 px-4 py-2 rounded-xl border border-white/10">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-2xl font-mono text-white">{highScore}s</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3 md:gap-4 max-w-md w-full">
        {cards.map((card, i) => (
          <motion.button
            key={card.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handleFlip(i)}
            className={`aspect-square rounded-2xl flex items-center justify-center text-4xl transition-all duration-300 relative preserve-3d
              ${card.flipped || card.matched ? 'bg-indigo-500/20 border-indigo-500/50' : 'bg-white/5 border-white/10'}`}
          >
            <motion.div
              initial={false}
              animate={{ rotateY: card.flipped || card.matched ? 0 : 180 }}
              transition={{ duration: 0.4 }}
              className="w-full h-full flex items-center justify-center backface-hidden"
            >
              {card.flipped || card.matched ? card.icon : '?'}
            </motion.div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {gameWon && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md"
          >
            <Trophy className="w-24 h-24 text-yellow-400 mb-6" />
            <h2 className="text-4xl font-bold text-white mb-2">Well Done!</h2>
            <p className="text-xl text-indigo-200 mb-8">You finished in {timer} seconds</p>
            <button
              onClick={initGame}
              className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl font-bold transition-all"
            >
              Play Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={initGame}
        className="mt-8 px-6 py-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-white transition-all flex items-center gap-2 text-sm uppercase tracking-widest"
      >
        <RefreshCcw className="w-4 h-4" />
        Reset Game
      </button>
    </div>
  );
}

interface Message {
  id: string;
  role: 'user' | 'bot';
  type: 'text' | 'image';
  content: string;
  originalImage?: string;
}

function FunnyBabyCreator() {
  const funnyPersonas = [
    { name: 'Cute Chubby Baby 👶', description: 'a cute and funny baby', prompt: 'a very chubby, cute, funny little toddler version of themselves. They are wearing a hilarious oversized baby bonnet and a colorful cute bib.' },
    { name: 'Dressed-up Monkey 🐒', description: 'a cute baby monkey with custom dressing', prompt: 'a hilarious, cute little dressed-up baby monkey version of themselves, wearing a tiny human hoodie.' },
    { name: 'Cute Baby Bear 🧸', description: 'a cute baby bear', prompt: 'a super fluffy, cute baby bear / teddy bear version of themselves with human-like expressions and posture.' },
    { name: 'Mini Dinosaur 🦖', description: 'a baby dinosaur', prompt: 'a funny, cute baby green t-rex / dinosaur wearing a cozy scaly onesie with tiny spikes.' },
    { name: 'Chubby Panda 🐼', description: 'a funny chubby panda', prompt: 'a super chubby, cute baby panda version of themselves, holding a tiny bamboo leaf with a giant smile.' },
    { name: 'Cute Kitten 🐱', description: 'a cute little kitten', prompt: 'a cute, hilarious, and fluffy little baby kitten version of themselves wearing a cute tiny collar.' },
    { name: 'Adorable Puppy 🐶', description: 'a playful baby puppy', prompt: 'a hilarious, adorable, fluffy little baby puppy caricature version of themselves.' },
    { name: 'Mini Astronaut 🧑‍🚀', description: 'a funny chubby space explorer', prompt: 'a hilarious chubby little baby astronaut version of themselves floating in space with a bubble helmet.' },
    { name: 'King/Queen Baby 👑', description: 'a funny royal ruler', prompt: 'a hilarious little medieval royal king/queen baby version of themselves wearing an oversized sliding crown and holding a toy scepter.' },
    { name: 'Chubby Penguin 🐧', description: 'a cute baby penguin', prompt: 'a hilarious cute baby penguin version of themselves wearing a tiny, cute red bowtie.' }
  ];

  const initialBotMsg = "Hey there! Feeling a bit stressed or sad? I'm here to cheer you up! 😊 Send me a photo, and I'll magically transform you into something super cute, funny, and random (like a baby, a cute monkey, a fluffy bear, or another funny creature) while keeping your actual face perfectly intact! Let's get a laugh! 🪄✨";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'bot',
      type: 'text',
      content: initialBotMsg
    }
  ]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        const userMsg: Message = {
          id: Date.now().toString(),
          role: 'user',
          type: 'image',
          content: base64
        };
        setMessages(prev => [...prev, userMsg]);
        transformImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const transformImage = async (image: string) => {
    setLoading(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64Data = image.split(',')[1];
      
      const persona = funnyPersonas[Math.floor(Math.random() * funnyPersonas.length)];
      
      const promptText = `Role: Funny Photo Transformer.
Input: A user's photo.
Target transformation: Transform the person into: ${persona.prompt}.

CRITICAL CONSTRAINT - FACE PRESERVATION (MOST IMPORTANT):
- Do NOT alter, modify, or replace the face of the person in the input photo.
- Keep the exact facial structure, eyes, nose, mouth, expression, eye gaze, eyebrows, hair color, and distinctive facial features of the original person.
- The face must remain 100% easily recognizable as the exact same person. It should feel like a flawless, highly convincing "face swap" or seamless blend where their actual face is preserved completely intact, but is comical because it is on the body/head shape of ${persona.prompt}.
- Absolutely do NOT generalize or randomize the face. Maintain the highest degree of facial similarity to the source photo.
- Make the overall image hilarious, cute, and highly stylized, while keeping the user's face perfectly preserved.
- Respond with ONLY the generated image. Do not add text in the image or any letterboxes/black borders.`;

      const response = await safeGenerateContent(ai, {
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: 'image/png',
              },
            },
            {
              text: promptText,
            },
          ],
        },
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const result = `data:image/png;base64,${part.inlineData.data}`;
          const botMsg: Message = {
            id: (Date.now() + 1).toString(),
            role: 'bot',
            type: 'image',
            content: result,
            originalImage: image
          };
          
          const botTextMsg: Message = {
            id: (Date.now() + 2).toString(),
            role: 'bot',
            type: 'text',
            content: `OMG! Look at this! 😂 I transformed you into: **${persona.name}** while keeping your face completely intact! Hope this brings a big smile to your face! ❤️`
          };

          setMessages(prev => [...prev, botMsg, botTextMsg]);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'bot',
          type: 'text',
          content: "Oops! I couldn't quite catch that magic. Can you try another photo? 😅"
        }]);
      }
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'bot',
        type: 'text',
        content: "I'm having a little trouble with my magic wand right now. Please try again in a bit! 🪄✨"
      }]);
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'funny-magic-me.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="w-full h-full absolute inset-0 flex flex-col bg-slate-950">
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-white/10 bg-slate-900/50 flex items-center justify-between backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-orange-500 to-yellow-500 flex items-center justify-center shadow-lg shadow-orange-500/20 ring-2 ring-white/10">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div>
              <h3 className="text-white text-lg font-bold leading-none">Funny Transformation Bot</h3>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <p className="text-orange-400 text-[10px] uppercase tracking-widest font-bold">Online & Ready to Cheer You Up</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => setMessages([{
              id: '1',
              role: 'bot',
              type: 'text',
              content: initialBotMsg
            }])}
            className="p-3 hover:bg-white/10 rounded-2xl transition-all text-white/40 hover:text-white active:scale-95"
            title="Clear Chat"
          >
            <RefreshCcw className="w-6 h-6" />
          </button>
        </div>

        {/* Chat Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth bg-[radial-gradient(circle_at_center,rgba(249,115,22,0.05)_0%,transparent_100%)]"
        >
          <div className="max-w-4xl mx-auto space-y-8">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-4 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center shadow-lg ${
                    msg.role === 'user' ? 'bg-white/10' : 'bg-orange-500'
                  }`}>
                    {msg.role === 'user' ? <User className="w-6 h-6 text-white/60" /> : <Bot className="w-6 h-6 text-white" />}
                  </div>
                  
                  <div className={`space-y-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`p-5 rounded-3xl shadow-xl ${
                      msg.role === 'user' 
                        ? 'bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-tr-none' 
                        : 'bg-white/5 text-white/90 border border-white/10 rounded-tl-none backdrop-blur-sm'
                    }`}>
                      {msg.type === 'text' ? (
                        <p className="text-base leading-relaxed">{msg.content}</p>
                      ) : (
                        <div className="space-y-4">
                          <div className="relative group">
                            <img 
                              src={msg.content} 
                              alt="Funny" 
                              className="rounded-2xl w-full max-w-md object-cover shadow-2xl border border-white/10" 
                              referrerPolicy="no-referrer"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl backdrop-blur-[2px]">
                              <Sparkles className="w-12 h-12 text-orange-400 animate-pulse" />
                            </div>
                          </div>
                          {msg.role === 'bot' && (
                            <button
                              onClick={() => downloadImage(msg.content)}
                              className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all border border-white/5"
                            >
                              <Download className="w-5 h-5" />
                              Save to Gallery
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-white/20 font-bold uppercase tracking-widest px-1">
                      {msg.role === 'user' ? 'You' : 'Funny Bot'}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
            
            {loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="flex gap-4">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                    <Bot className="w-6 h-6 text-white" />
                  </div>
                  <div className="bg-white/5 border border-white/10 p-5 rounded-3xl rounded-tl-none flex items-center gap-3 backdrop-blur-sm">
                    <div className="relative">
                      <Loader2 className="w-5 h-5 text-orange-400 animate-spin" />
                      <div className="absolute inset-0 blur-sm bg-orange-400/20 animate-pulse" />
                    </div>
                    <span className="text-sm text-white/60 font-medium tracking-wide">Bot is sprinkling funny magic... ✨</span>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Chat Input */}
        <div className="p-4 md:p-6 border-t border-white/10 bg-slate-900/80 backdrop-blur-xl">
          <div className="max-w-4xl mx-auto flex gap-4 items-center">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-14 h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-orange-400 transition-all disabled:opacity-50 active:scale-90 shadow-lg"
              title="Upload Photo"
            >
              <ImageIcon className="w-7 h-7" />
            </button>
            <div 
              onClick={() => !loading && fileInputRef.current?.click()}
              className="flex-1 h-14 bg-white/5 border border-white/10 rounded-2xl px-6 flex items-center cursor-pointer hover:bg-white/10 transition-all group"
            >
              <p className="text-white/30 text-base group-hover:text-white/50 transition-colors">Upload a photo to see the magic...</p>
            </div>
            <button
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="w-14 h-14 rounded-2xl bg-gradient-to-r from-orange-500 to-yellow-500 flex items-center justify-center text-white shadow-xl shadow-orange-500/30 hover:scale-105 transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className="w-6 h-6" />
            </button>
          </div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleUpload} 
            accept="image/*" 
            className="hidden" 
          />
        </div>
      </div>
    </div>
  );
}

function ZenGarden({ isFullScreen = false }: { isFullScreen?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#6366f1');
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (parent) {
        const temp = ctx.getImageData(0, 0, canvas.width, canvas.height);
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.putImageData(temp, 0, 0);
      }
    };

    window.addEventListener('resize', resize);
    resize();

    return () => window.removeEventListener('resize', resize);
  }, [isFullScreen]);

  const getPos = (e: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as MouseEvent).clientX;
      clientY = (e as MouseEvent).clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    const pos = getPos(e);
    if (pos) lastPos.current = pos;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPos.current = null;
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const pos = getPos(e);
    if (!pos) return;

    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.shadowBlur = 8;
    ctx.shadowColor = color;

    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastPos.current = pos;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  return (
    <div className="w-full h-full absolute inset-0 flex flex-col">
      <div className="absolute top-6 left-6 z-10 flex flex-wrap gap-4">
        <div className="flex bg-black/40 p-2 rounded-2xl border border-white/10 gap-2">
          {['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#ef4444', '#ffffff'].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full border-2 transition-all ${color === c ? 'border-white scale-110' : 'border-transparent opacity-50'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <button
          onClick={clear}
          className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 text-white transition-all flex items-center gap-2"
        >
          <RefreshCcw className="w-5 h-5" />
          Clear
        </button>
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseOut={stopDrawing}
        onTouchStart={startDrawing}
        onTouchMove={draw}
        onTouchEnd={stopDrawing}
        className="w-full h-full cursor-crosshair touch-none"
      />

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 pointer-events-none text-white/20 text-xs font-medium uppercase tracking-widest text-center px-4">
        Draw slowly and breathe...
      </div>
    </div>
  );
}
