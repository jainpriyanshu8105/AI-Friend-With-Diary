import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Trophy, Timer, Play, RotateCcw, Swords, Zap } from 'lucide-react';

interface Watermelon {
  id: number;
  x: number;
  y: number;
  size: number;
  speedX: number;
  speedY: number;
  isSliced: boolean;
  rotation: number;
  rotationSpeed: number;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const GAME_DURATION = 30;

export const WatermelonSlicer: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('watermelon_high_score');
    return saved ? parseInt(saved, 10) : 0;
  });
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION);
  const [watermelons, setWatermelons] = useState<Watermelon[]>([]);
  const [particles, setParticles] = useState<Particle[]>([]);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(undefined);
  const lastSpawnTime = useRef<number>(0);
  const nextId = useRef(0);
  const audioCtx = useRef<AudioContext | null>(null);

  // Procedural Slice Sound
  const playSliceSound = () => {
    try {
      if (!audioCtx.current) {
        audioCtx.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtx.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(150, ctx.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.1);

      // Noise burst for "crunch"
      const bufferSize = ctx.sampleRate * 0.05;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.1, ctx.currentTime);
      noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      noise.connect(noiseGain);
      noiseGain.connect(ctx.destination);
      noise.start();
    } catch (e) {
      console.error("Audio failed", e);
    }
  };

  const startGame = () => {
    setScore(0);
    setTimeLeft(GAME_DURATION);
    setWatermelons([]);
    setParticles([]);
    setGameState('playing');
    lastSpawnTime.current = performance.now();
  };

  const spawnWatermelon = useCallback(() => {
    if (!gameContainerRef.current) return;
    const width = gameContainerRef.current.clientWidth;
    const height = gameContainerRef.current.clientHeight;
    
    // Spawn from bottom like Fruit Ninja
    const newWatermelon: Watermelon = {
      id: nextId.current++,
      x: Math.random() * (width - 100) + 50,
      y: height + 50,
      size: Math.random() * 30 + 70,
      speedX: (Math.random() - 0.5) * 4,
      speedY: -(Math.random() * 5 + 12), // Upward force
      isSliced: false,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 10,
    };
    setWatermelons(prev => [...prev, newWatermelon]);
  }, []);

  const createParticles = (x: number, y: number) => {
    const newParticles: Particle[] = [];
    for (let i = 0; i < 12; i++) {
      newParticles.push({
        id: Math.random(),
        x,
        y,
        vx: (Math.random() - 0.5) * 15,
        vy: (Math.random() - 0.5) * 15,
        life: 1,
        color: Math.random() > 0.3 ? '#ef4444' : '#22c55e',
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  };

  const updateGame = useCallback((time: number) => {
    if (gameState !== 'playing') return;

    // Spawn new watermelons
    const spawnInterval = Math.max(600, 1500 - score * 20);
    if (time - lastSpawnTime.current > spawnInterval) {
      spawnWatermelon();
      lastSpawnTime.current = time;
    }

    // Update positions
    setWatermelons(prev => {
      return prev
        .map(w => ({
          ...w,
          x: w.x + w.speedX,
          y: w.y + w.speedY,
          speedY: w.speedY + 0.25, // Gravity
          rotation: w.rotation + w.rotationSpeed,
        }))
        .filter(w => w.y < 1200 && w.x > -200 && w.x < 1500);
    });

    // Update particles
    setParticles(prev => {
      return prev
        .map(p => ({
          ...p,
          x: p.x + p.vx,
          y: p.y + p.vy,
          vy: p.vy + 0.5,
          life: p.life - 0.02,
        }))
        .filter(p => p.life > 0);
    });

    requestRef.current = requestAnimationFrame(updateGame);
  }, [gameState, score, spawnWatermelon]);

  useEffect(() => {
    if (gameState === 'playing') {
      requestRef.current = requestAnimationFrame(updateGame);
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            setGameState('ended');
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        clearInterval(timer);
      };
    }
  }, [gameState, updateGame]);

  useEffect(() => {
    if (gameState === 'ended' && score > highScore) {
      setHighScore(score);
      localStorage.setItem('watermelon_high_score', score.toString());
    }
  }, [gameState, score, highScore]);

  const handleSlice = (id: number, x: number, y: number) => {
    if (gameState !== 'playing') return;
    setWatermelons(prev => 
      prev.map(w => {
        if (w.id === id && !w.isSliced) {
          playSliceSound();
          createParticles(x, y);
          setScore(s => s + 1);
          return { ...w, isSliced: true };
        }
        return w;
      })
    );
  };

  return (
    <div className="absolute inset-0 bg-[#0f172a] font-sans overflow-hidden select-none">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-rose-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Game Overlay UI */}
      <div className="absolute top-0 left-0 right-0 p-4 flex items-start justify-between z-40 pointer-events-none">
        <button
          onClick={onBack}
          className="p-3 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 shadow-xl hover:bg-white/10 transition-all group pointer-events-auto"
        >
          <ArrowLeft className="w-6 h-6 text-white group-hover:-translate-x-1 transition-transform" />
        </button>
        
        <div className="flex gap-6 sm:gap-10 items-start">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
              <Timer className="w-3 h-3" />
              Time
            </div>
            <div className={`text-3xl font-black tabular-nums ${timeLeft <= 5 ? 'text-rose-500 animate-bounce' : 'text-white'}`}>
              {timeLeft}s
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-black uppercase tracking-[0.2em]">
              <Swords className="w-3 h-3" />
              Score
            </div>
            <div className="text-3xl font-black text-white tabular-nums">
              {score}
            </div>
          </div>

          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-white/20 text-[8px] font-black uppercase tracking-[0.2em]">
              <Trophy className="w-2 h-2" />
              Best
            </div>
            <div className="text-sm font-black text-amber-500/60 tabular-nums">
              {highScore}
            </div>
          </div>
        </div>
      </div>

      {/* Game Area */}
      <div 
        ref={gameContainerRef}
        className="relative w-full h-full overflow-hidden cursor-crosshair"
      >
        {/* Particles */}
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full pointer-events-none"
            style={{
              left: p.x,
              top: p.y,
              width: 8,
              height: 8,
              backgroundColor: p.color,
              opacity: p.life,
              transform: `scale(${p.life})`,
            }}
          />
        ))}

        <AnimatePresence>
          {gameState === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-slate-950/60 backdrop-blur-xl"
            >
              <motion.div 
                animate={{ y: [0, -20, 0], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-9xl mb-8 drop-shadow-[0_0_30px_rgba(34,197,94,0.5)]"
              >
                🍉
              </motion.div>
              <button
                onClick={startGame}
                className="group relative flex items-center gap-4 px-12 py-6 bg-emerald-500 text-white rounded-[32px] font-black text-3xl hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(16,185,129,0.3)]"
              >
                <Play className="w-8 h-8 fill-current" />
                PLAY NOW
                <div className="absolute inset-0 bg-white/20 rounded-[32px] opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </motion.div>
          )}

          {gameState === 'ended' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-slate-950/80 backdrop-blur-2xl"
            >
              <div className="text-7xl mb-6">🏁</div>
              <h2 className="text-5xl font-black text-white mb-4">Game Over!</h2>
              <div className="flex flex-col items-center gap-2 mb-12">
                <div className="text-xl font-bold text-white/40 uppercase tracking-[0.3em]">Your Score</div>
                <div className="text-9xl font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]">{score}</div>
                {score >= highScore && score > 0 && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-3 px-6 py-2 bg-amber-400 text-amber-950 rounded-full text-sm font-black uppercase tracking-wider mt-4"
                  >
                    <Trophy className="w-5 h-5" /> New High Score!
                  </motion.div>
                )}
              </div>
              <div className="flex gap-6">
                <button
                  onClick={startGame}
                  className="flex items-center gap-3 px-10 py-5 bg-white text-slate-950 rounded-3xl font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-2xl"
                >
                  <RotateCcw className="w-6 h-6" />
                  REPLAY
                </button>
                <button
                  onClick={onBack}
                  className="px-10 py-5 bg-white/5 text-white border-2 border-white/10 rounded-3xl font-black text-xl hover:bg-white/10 transition-all"
                >
                  EXIT
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Watermelons */}
        {watermelons.map((w) => (
          <div
            key={w.id}
            className="absolute transition-transform duration-75"
            style={{
              left: w.x,
              top: w.y,
              transform: `rotate(${w.rotation}deg)`,
              width: w.size,
              height: w.size,
            }}
            onMouseEnter={(e) => handleSlice(w.id, w.x + w.size/2, w.y + w.size/2)}
            onTouchStart={(e) => handleSlice(w.id, w.x + w.size/2, w.y + w.size/2)}
          >
            {!w.isSliced ? (
              <div className="relative w-full h-full cursor-crosshair select-none filter drop-shadow-2xl">
                {/* Whole Watermelon SVG */}
                <svg viewBox="0 0 100 100" className="w-full h-full">
                  <defs>
                    <linearGradient id={`grad-${w.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#064e3b" />
                      <stop offset="100%" stopColor="#065f46" />
                    </linearGradient>
                  </defs>
                  <ellipse cx="50" cy="50" rx="45" ry="35" fill={`url(#grad-${w.id})`} />
                  {/* Stripes */}
                  <path d="M20 30 Q 50 20 80 30" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
                  <path d="M15 50 Q 50 40 85 50" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
                  <path d="M20 70 Q 50 80 80 70" fill="none" stroke="#059669" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
                </svg>
              </div>
            ) : (
              <div className="relative flex items-center justify-center" style={{ width: w.size, height: w.size }}>
                {/* Sliced Watermelon Visual */}
                <motion.div 
                  initial={{ x: 0, opacity: 1 }}
                  animate={{ x: -w.size/2, y: 50, rotate: -45, opacity: 0 }}
                  className="absolute w-full h-full"
                  style={{ clipPath: 'inset(0 50% 0 0)' }}
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <ellipse cx="50" cy="50" rx="45" ry="35" fill="#ef4444" stroke="#064e3b" strokeWidth="4" />
                    <circle cx="40" cy="45" r="2" fill="#000" />
                    <circle cx="30" cy="55" r="2" fill="#000" />
                    <circle cx="45" cy="60" r="2" fill="#000" />
                  </svg>
                </motion.div>
                <motion.div 
                  initial={{ x: 0, opacity: 1 }}
                  animate={{ x: w.size/2, y: 50, rotate: 45, opacity: 0 }}
                  className="absolute w-full h-full"
                  style={{ clipPath: 'inset(0 0 0 50%)' }}
                >
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <ellipse cx="50" cy="50" rx="45" ry="35" fill="#ef4444" stroke="#064e3b" strokeWidth="4" />
                    <circle cx="60" cy="45" r="2" fill="#000" />
                    <circle cx="70" cy="55" r="2" fill="#000" />
                    <circle cx="55" cy="60" r="2" fill="#000" />
                  </svg>
                </motion.div>
                <motion.div
                  initial={{ scale: 0.5, opacity: 1 }}
                  animate={{ scale: 2, opacity: 0 }}
                  className="absolute text-emerald-400 font-black text-2xl z-10"
                >
                  +1
                </motion.div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
