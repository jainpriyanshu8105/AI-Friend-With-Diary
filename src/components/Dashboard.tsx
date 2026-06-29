import React from 'react';
import { motion } from 'motion/react';
import { MessageCircle, BookHeart, Sparkles } from 'lucide-react';

interface DashboardProps {
  name: string;
  onNavigate: (view: 'diary' | 'talk' | 'games') => void;
}

export function Dashboard({ name, onNavigate }: DashboardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center min-h-[80vh] px-4"
    >
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Hello Champ, <span className="text-indigo-400">{name}</span>!
        </h1>
        <p className="text-xl text-indigo-200">How are you feeling today?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl">
        <button
          onClick={() => onNavigate('talk')}
          className="group relative overflow-hidden bg-gradient-to-br from-indigo-500/20 to-purple-500/20 hover:from-indigo-500/30 hover:to-purple-500/30 border border-white/10 p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20 text-left"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <MessageCircle className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="bg-indigo-500/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <MessageCircle className="w-8 h-8 text-indigo-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Talk to Friend</h2>
            <p className="text-indigo-200">Share your feelings, vent out anger, or just chat. I'm here to listen.</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('diary')}
          className="group relative overflow-hidden bg-gradient-to-br from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-white/10 p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-emerald-500/20 text-left"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <BookHeart className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="bg-emerald-500/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <BookHeart className="w-8 h-8 text-emerald-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Your Diary</h2>
            <p className="text-emerald-200">Record your achievements, universe, and memories safely.</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('games')}
          className="group relative overflow-hidden bg-gradient-to-br from-orange-500/20 to-red-500/20 hover:from-orange-500/30 hover:to-red-500/30 border border-white/10 p-8 rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-orange-500/20 text-left"
        >
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <div className="bg-orange-500/30 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="w-8 h-8 text-orange-300" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Stress Buster</h2>
            <p className="text-orange-200">Play relaxing games to calm your mind and release anger.</p>
          </div>
        </button>
      </div>
    </motion.div>
  );
}
