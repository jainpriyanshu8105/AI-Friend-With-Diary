import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Sparkles, Loader2, User, Heart, Zap, Trash2, Smile, Mic, Square, Clock, MapPin, Info, X, Camera, ImageIcon } from 'lucide-react';
import { ChatMessage, UserData, AIProfile, Reminder } from '../types';
import Markdown from 'react-markdown';
import EmojiPicker from 'emoji-picker-react';
import { db } from '../firebase';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { format, addHours, addDays, startOfTomorrow, setHours, setMinutes, isAfter } from 'date-fns';

function compressImage(base64Str: string, maxDim: number = 800): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.7));
    };
  });
}

interface TalkProps {
  name: string;
  aiFriend?: UserData['aiFriend'];
  onSetAiFriend: (type: 'girl' | 'boy', name: string, profileId?: string) => Promise<void>;
  history: ChatMessage[];
  diaryEntries: UserData['diaryEntries'];
  reminders: Reminder[];
  onAddReminder: (time: string, message: string) => Promise<void>;
  onSendMessage: (message: string, audioData?: string, imageData?: string) => Promise<void>;
  onClearChat: () => Promise<void>;
  onBack: () => void;
  isTyping: boolean;
}

export function Talk({ name, aiFriend, onSetAiFriend, history, diaryEntries, reminders, onAddReminder, onSendMessage, onClearChat, onBack, isTyping }: TalkProps) {
  const [input, setInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [setupType, setSetupType] = useState<'girl' | 'boy' | null>(aiFriend?.type || null);
  const [setupName, setSetupName] = useState(aiFriend?.name || '');
  const [selectedProfile, setSelectedProfile] = useState<AIProfile | null>(null);
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [reminderTab, setReminderTab] = useState<'set' | 'list'>('set');
  const [reminderTime, setReminderTime] = useState('');
  const [reminderMessage, setReminderMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const smileButtonRef = useRef<HTMLButtonElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        return;
      }
      setIsCompressing(true);
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const compressed = await compressImage(reader.result as string);
          setSelectedImage(compressed);
        } catch (error) {
          console.error('Error compressing image:', error);
          alert('Failed to process image');
        } finally {
          setIsCompressing(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (setupType) {
      fetchProfiles(setupType);
    }
  }, [setupType]);

  const fetchProfiles = async (type: 'girl' | 'boy') => {
    setLoadingProfiles(true);
    try {
      const q = query(collection(db, 'aiProfiles'), where('type', '==', type));
      const snapshot = await getDocs(q);
      const profilesData: AIProfile[] = [];
      snapshot.forEach((doc) => {
        profilesData.push({ id: doc.id, ...doc.data() } as AIProfile);
      });
      setProfiles(profilesData);
      // Reset selection if type changes
      setSelectedProfile(null);
      setSetupName('');
    } catch (error) {
      const { OperationType, handleFirestoreError } = await import('../firebase');
      handleFirestoreError(error, OperationType.LIST, 'aiProfiles');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await onSendMessage('', base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [history, isTyping]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current && 
        !emojiPickerRef.current.contains(event.target as Node) &&
        smileButtonRef.current &&
        !smileButtonRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || selectedImage) && !isTyping && !isCompressing) {
      const msg = input.trim();
      const img = selectedImage || undefined;
      setInput('');
      setSelectedImage(null);
      setShowEmojiPicker(false);
      await onSendMessage(msg, undefined, img);
    }
  };

  const handleSetReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reminderTime && reminderMessage.trim()) {
      const timeStr = new Date(reminderTime).toISOString();
      await onAddReminder(timeStr, reminderMessage.trim());
      
      // Also send a message to AI so it knows
      const msg = `[SYSTEM: User set a reminder for ${new Date(reminderTime).toLocaleString()} with message: "${reminderMessage.trim()}"] I've set a reminder for myself.`;
      setShowReminderModal(false);
      setReminderTime('');
      setReminderMessage('');
      await onSendMessage(msg);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (setupType && setupName.trim()) {
      await onSetAiFriend(setupType, setupName.trim(), selectedProfile?.id);
      setIsChatting(true);
    }
  };

  if (!isChatting || !aiFriend) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl mx-auto w-full h-[90vh] flex flex-col p-4 md:p-6"
      >
        <div className="flex items-center mb-6">
          <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors mr-4 z-50">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        </div>
        <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-6 md:p-10 backdrop-blur-xl relative overflow-hidden flex-1 flex flex-col">
          
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Choose Your Friend</h2>
            <p className="text-white/60">Select a personality that matches what you're looking for.</p>
          </div>

          <form onSubmit={handleSetupSubmit} className="flex flex-col gap-8 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4 md:gap-6 shrink-0">
              <button
                type="button"
                onClick={() => setSetupType('girl')}
                className={`flex flex-col items-center gap-4 p-4 md:p-6 rounded-3xl border-2 transition-all ${
                  setupType === 'girl' 
                    ? 'border-pink-500 bg-pink-500/20 shadow-[0_0_30px_rgba(236,72,153,0.2)]' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-pink-500/20 flex items-center justify-center overflow-hidden border-4 border-pink-500/30">
                  <img src="https://api.dicebear.com/7.x/lorelei/svg?seed=Lily&backgroundColor=transparent" alt="Girl Avatar" className="w-12 h-12 md:w-16 md:h-16" />
                </div>
                <span className="text-lg font-semibold text-white">Girl</span>
              </button>

              <button
                type="button"
                onClick={() => setSetupType('boy')}
                className={`flex flex-col items-center gap-4 p-4 md:p-6 rounded-3xl border-2 transition-all ${
                  setupType === 'boy' 
                    ? 'border-blue-500 bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.2)]' 
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }`}
              >
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-500/20 flex items-center justify-center overflow-hidden border-4 border-blue-500/30">
                  <img src="https://api.dicebear.com/7.x/lorelei/svg?seed=Oliver&backgroundColor=transparent" alt="Boy Avatar" className="w-12 h-12 md:w-16 md:h-16" />
                </div>
                <span className="text-lg font-semibold text-white">Boy</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {setupType && (
                <motion.div
                  key={setupType}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white/80 ml-2">Select a Character:</h3>
                    
                    {loadingProfiles ? (
                      <div className="flex justify-center p-8">
                        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                      </div>
                    ) : profiles.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {profiles.map((profile) => (
                          <button
                            key={profile.id}
                            type="button"
                            onClick={() => {
                              setSelectedProfile(profile);
                            }}
                            className={`p-4 rounded-2xl border-2 text-left transition-all group relative overflow-hidden ${
                              selectedProfile?.id === profile.id
                                ? setupType === 'girl' ? 'border-pink-500 bg-pink-500/10' : 'border-blue-500 bg-blue-500/10'
                                : 'border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10'
                            }`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <h4 className="font-bold text-white text-lg">{profile.location}</h4>
                              <div className={`p-1.5 rounded-lg ${setupType === 'girl' ? 'bg-pink-500/20 text-pink-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                <User className="w-4 h-4" />
                              </div>
                            </div>
                            <p className="text-sm text-white/60 line-clamp-2 mb-3">{profile.bio}</p>
                            <div className="flex items-center gap-2 text-xs text-white/40">
                              <MapPin className="w-3 h-3" /> {profile.location}
                            </div>
                            
                            {selectedProfile?.id === profile.id && (
                              <motion.div
                                layoutId="active-character"
                                className={`absolute inset-0 border-2 pointer-events-none ${setupType === 'girl' ? 'border-pink-500' : 'border-blue-500'}`}
                                initial={false}
                              />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-4">
                    <label className="text-white/80 font-medium ml-2">
                      {selectedProfile ? `Give a name to your friend from ${selectedProfile.location}:` : 'Give your friend a name:'}
                    </label>
                    <input
                      type="text"
                      value={setupName}
                      onChange={(e) => setSetupName(e.target.value)}
                      placeholder={setupType === 'girl' ? 'e.g., Lily, Sarah...' : 'e.g., Max, Alex...'}
                      className={`w-full bg-black/20 border-2 rounded-2xl px-6 py-4 text-white placeholder-white/30 focus:outline-none transition-colors ${
                        setupType === 'girl' ? 'border-pink-500/30 focus:border-pink-500' : 'border-blue-500/30 focus:border-blue-500'
                      }`}
                      required
                    />
                    <button
                      type="submit"
                      disabled={!setupName.trim()}
                      className={`w-full py-4 rounded-2xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-4 ${
                        setupType === 'girl' 
                          ? 'bg-pink-500 hover:bg-pink-600 text-white shadow-[0_0_20px_rgba(236,72,153,0.4)]' 
                          : 'bg-blue-500 hover:bg-blue-600 text-white shadow-[0_0_20px_rgba(59,130,246,0.4)]'
                      }`}
                    >
                      {aiFriend?.type === setupType && aiFriend?.name === setupName.trim() 
                        ? `Continue Chatting with ${setupName}` 
                        : `Start Chatting with ${setupName || 'Friend'}`}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </div>
      </motion.div>
    );
  }

  const isGirl = aiFriend.type === 'girl';
  const theme = isGirl ? {
    color: 'pink',
    bg: 'bg-pink-500/20',
    border: 'border-pink-500/30',
    borderContainer: 'border-pink-500/20',
    shadow: 'shadow-[0_0_15px_rgba(236,72,153,0.3)]',
    shadowContainer: 'shadow-[0_0_30px_rgba(236,72,153,0.1)]',
    textLight: 'text-pink-200/70',
    textMain: 'text-pink-400',
    bgLight: 'bg-pink-500/10',
    bgUserMsg: 'bg-pink-600',
    shadowUserMsg: 'shadow-pink-900/20',
    ring: 'focus:ring-pink-500',
    btnBg: 'bg-pink-600',
    btnHover: 'hover:bg-pink-500',
    seed: 'Lily',
    avatarStyle: 'lorelei',
    Icon: Heart
  } : {
    color: 'blue',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30',
    borderContainer: 'border-blue-500/20',
    shadow: 'shadow-[0_0_15px_rgba(59,130,246,0.3)]',
    shadowContainer: 'shadow-[0_0_30px_rgba(59,130,246,0.1)]',
    textLight: 'text-blue-200/70',
    textMain: 'text-blue-400',
    bgLight: 'bg-blue-500/10',
    bgUserMsg: 'bg-blue-600',
    shadowUserMsg: 'shadow-blue-900/20',
    ring: 'focus:ring-blue-500',
    btnBg: 'bg-blue-600',
    btnHover: 'hover:bg-blue-500',
    seed: 'Oliver',
    avatarStyle: 'lorelei',
    Icon: Zap
  };

  const Icon = theme.Icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-4xl mx-auto w-full h-[90vh] flex flex-col"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <button onClick={() => setIsChatting(false)} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors mr-4">
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-full ${theme.bg} flex items-center justify-center overflow-hidden border-2 ${theme.border} ${theme.shadow}`}>
              <img src={`https://api.dicebear.com/7.x/${theme.avatarStyle}/svg?seed=${theme.seed}&backgroundColor=transparent`} alt="Avatar" className="w-12 h-12" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                {aiFriend.name}
                <Icon className={`w-5 h-5 ${theme.textMain}`} />
              </h1>
              <p className={`text-sm ${theme.textLight}`}>Always here to listen, {name}</p>
            </div>
          </div>
        </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowReminderModal(true)}
              className={`p-2 rounded-full transition-colors border relative ${
                reminders.filter(r => r.status === 'pending').length > 0 
                  ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' 
                  : 'bg-white/5 hover:bg-white/10 text-white/40 border-white/10'
              }`}
              title="Manage Reminders"
            >
              <Clock className="w-5 h-5" />
              {reminders.filter(r => r.status === 'pending').length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full">
                  {reminders.filter(r => r.status === 'pending').length}
                </span>
              )}
            </button>
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-full transition-colors border border-red-500/20"
              title="Clear Chat History"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-2">Clear Chat?</h3>
              <p className="text-white/60 mb-6">
                Are you sure you want to delete all messages with {aiFriend.name}? This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-3 rounded-xl font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setShowDeleteConfirm(false);
                    await onClearChat();
                  }}
                  className="flex-1 py-3 rounded-xl font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
                >
                  Clear Chat
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showReminderModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className={`w-5 h-5 ${theme.textMain}`} />
                  Reminders
                </h3>
                <button 
                  onClick={() => setShowReminderModal(false)}
                  className="p-2 text-white/40 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="flex bg-white/5 p-1 rounded-xl mb-6">
                <button
                  onClick={() => setReminderTab('set')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    reminderTab === 'set' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Set New
                </button>
                <button
                  onClick={() => setReminderTab('list')}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                    reminderTab === 'list' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  Active ({reminders.filter(r => r.status === 'pending').length})
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                {reminderTab === 'set' ? (
                  <form onSubmit={handleSetReminder} className="flex flex-col gap-6">
                    <div className="space-y-4">
                      <label className="block text-sm font-medium text-white/70">Quick Presets</label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: 'In 1 Hour', date: addHours(new Date(), 1) },
                          { label: 'In 3 Hours', date: addHours(new Date(), 3) },
                          { label: 'Tomorrow 9AM', date: setMinutes(setHours(addDays(new Date(), 1), 9), 0) },
                          { label: 'Tomorrow 8PM', date: setMinutes(setHours(addDays(new Date(), 1), 20), 0) },
                        ].map((preset, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setReminderTime(format(preset.date, "yyyy-MM-dd'T'HH:mm"))}
                            className="py-2 px-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-xl text-xs text-white/60 hover:text-white transition-all"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-white/70">Custom Time</label>
                      <input
                        type="datetime-local"
                        value={reminderTime}
                        onChange={(e) => setReminderTime(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-white/70">Message</label>
                      <textarea
                        value={reminderMessage}
                        onChange={(e) => setReminderMessage(e.target.value)}
                        placeholder="e.g., Remind me to drink water, or send me a love letter!"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-white/20 resize-none h-24"
                        required
                      />
                    </div>
                    
                    <button
                      type="submit"
                      disabled={!reminderTime || !reminderMessage.trim()}
                      className={`w-full py-4 rounded-xl font-bold text-white transition-all disabled:opacity-50 shadow-lg ${theme.btnBg} ${theme.btnHover}`}
                    >
                      Set Reminder
                    </button>
                  </form>
                ) : (
                  <div className="space-y-4">
                    {reminders.filter(r => r.status === 'pending').length === 0 ? (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 text-white/10 mx-auto mb-4" />
                        <p className="text-white/40">No active reminders</p>
                      </div>
                    ) : (
                      reminders
                        .filter(r => r.status === 'pending')
                        .sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
                        .map((reminder) => (
                          <div 
                            key={reminder.id}
                            className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-start justify-between group"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Clock className={`w-3 h-3 ${theme.textMain}`} />
                                <span className="text-xs font-bold text-white/80">
                                  {format(new Date(reminder.time), 'MMM d, h:mm a')}
                                </span>
                              </div>
                              <p className="text-sm text-white/60 line-clamp-2">{reminder.message}</p>
                            </div>
                            <button
                              onClick={async () => {
                                try {
                                  const { auth, OperationType, handleFirestoreError } = await import('../firebase');
                                  const uid = auth.currentUser?.uid;
                                  if (uid) {
                                    await deleteDoc(doc(db, `users/${uid}/reminders`, reminder.id));
                                  }
                                } catch (e) {
                                  const { OperationType, handleFirestoreError } = await import('../firebase');
                                  const uid = (await import('../firebase')).auth.currentUser?.uid;
                                  handleFirestoreError(e, OperationType.DELETE, `users/${uid}/reminders/${reminder.id}`);
                                }
                              }}
                              className="p-2 text-white/20 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className={`flex-1 bg-white/5 border ${theme.borderContainer} rounded-3xl overflow-hidden flex flex-col ${theme.shadowContainer}`}>
        <div className="flex-1 overflow-y-auto p-4 md:p-6 flex flex-col gap-6">
          {history.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center text-white/50">
              <div className={`w-24 h-24 rounded-full ${theme.bgLight} flex items-center justify-center mb-6 border ${theme.borderContainer}`}>
                <img src={`https://api.dicebear.com/7.x/${theme.avatarStyle}/svg?seed=${theme.seed}&backgroundColor=transparent`} alt="Avatar" className="w-20 h-20 opacity-80" />
              </div>
              <p className="text-xl font-medium mb-2 text-white/80">Hi {name}! I'm {aiFriend.name}.</p>
              <p className="text-sm max-w-sm">Tell me what's on your mind. If you're angry, sad, or happy, I'm here to listen and help.</p>
            </div>
          )}
          
          {history.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden mr-3 shrink-0 mt-1">
                  <img src={`https://api.dicebear.com/7.x/${theme.avatarStyle}/svg?seed=${theme.seed}&backgroundColor=transparent`} alt="Avatar" className="w-6 h-6" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl p-4 ${
                  msg.role === 'user'
                    ? `${theme.bgUserMsg} text-white rounded-br-sm shadow-lg ${theme.shadowUserMsg}`
                    : 'bg-white/10 text-white/90 rounded-bl-sm border border-white/5'
                }`}
              >
                {msg.imageUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg mb-2 max-w-sm">
                    <img 
                      src={msg.imageUrl} 
                      alt="Uploaded photo" 
                      className="max-w-full h-auto object-cover max-h-60"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                )}
                {msg.audioUrl ? (
                  <div className="flex flex-col gap-2">
                    {msg.role === 'user' && <p className="text-sm opacity-70">🎤 Voice Message</p>}
                    <audio controls src={msg.audioUrl} className="max-w-full h-10 rounded-lg" />
                  </div>
                ) : msg.text.startsWith('🔔 **Reminder:**') ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-indigo-400">
                      <Clock className="w-5 h-5" />
                      <span className="font-bold">Reminder Triggered!</span>
                    </div>
                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4 text-indigo-100">
                      <Markdown>{msg.text.replace('🔔 **Reminder:**', '').trim()}</Markdown>
                    </div>
                  </div>
                ) : (
                  msg.role === 'model' ? (
                    <div className="flex flex-col gap-4">
                      {msg.imageId && diaryEntries.find(e => e.id === msg.imageId)?.image && (
                        <div className="rounded-xl overflow-hidden border border-white/10 shadow-lg">
                          <img 
                            src={diaryEntries.find(e => e.id === msg.imageId)?.image} 
                            alt="Diary photo" 
                            className="max-w-full h-auto object-cover"
                          />
                        </div>
                      )}
                      <div className="markdown-body prose prose-invert prose-sm max-w-none">
                        <Markdown>{msg.text}</Markdown>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )
                )}
              </div>
            </motion.div>
          ))}
          
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden mr-3 shrink-0 mt-1">
                <img src={`https://api.dicebear.com/7.x/${theme.avatarStyle}/svg?seed=${theme.seed}&backgroundColor=transparent`} alt="Avatar" className="w-6 h-6" />
              </div>
              <div className="bg-white/10 text-white/90 rounded-2xl rounded-bl-sm border border-white/5 p-4 flex items-center gap-3">
                <Loader2 className={`w-4 h-4 animate-spin ${theme.textMain}`} />
                <span className="text-sm text-white/60">{aiFriend.name} is typing...</span>
              </div>
            </motion.div>
          )}
          <div ref={messagesEndRef} />
        </div>

         <div className="p-4 bg-black/20 border-t border-white/5 relative">
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                ref={emojiPickerRef}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-full left-4 mb-4 z-50"
              >
                <EmojiPicker
                  onEmojiClick={(emojiData) => {
                    setInput(prev => prev + emojiData.emoji);
                  }}
                  theme={'dark' as any}
                />
              </motion.div>
            )}
          </AnimatePresence>
          
          {selectedImage && (
            <div className="relative inline-block mb-3 p-1.5 bg-white/5 rounded-2xl border border-white/10">
              <img 
                src={selectedImage} 
                alt="Selected preview" 
                className="w-20 h-20 object-cover rounded-xl font-sans"
              />
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-lg border border-slate-950 transition-colors"
                title="Remove Image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          {isCompressing && (
            <div className="flex items-center gap-2 mb-3 text-xs text-white/40">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-400" />
              Processing photo...
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-3">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleImageChange}
              accept="image/*"
              className="hidden"
            />
            <button
              ref={smileButtonRef}
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white border border-white/10 flex items-center justify-center"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white border border-white/10 flex items-center justify-center"
              title="Add a Photo"
              disabled={isRecording || isTyping}
            >
              <Camera className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowReminderModal(true)}
              className="p-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors text-white/70 hover:text-white border border-white/10 flex items-center justify-center"
              title="Set a Reminder"
            >
              <Clock className="w-5 h-5" />
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isRecording ? "Recording..." : `Message ${aiFriend.name}...`}
              className={`flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 ${theme.ring} transition-all ${isRecording ? 'animate-pulse bg-red-500/10 border-red-500/30' : ''}`}
              disabled={isTyping || isRecording}
            />
            {isRecording ? (
              <button
                type="button"
                onClick={stopRecording}
                className="bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl transition-all flex items-center justify-center shadow-lg shadow-red-900/20 animate-pulse"
              >
                <Square className="w-5 h-5 fill-current" />
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                disabled={isTyping || input.trim().length > 0 || !!selectedImage}
                className={`bg-white/10 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all flex items-center justify-center`}
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
            <button
              type="submit"
              disabled={(!input.trim() && !selectedImage) || isTyping || isRecording || isCompressing}
              className={`${theme.btnBg} ${theme.btnHover} disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-xl transition-all flex items-center justify-center shadow-lg ${theme.shadowUserMsg}`}
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
