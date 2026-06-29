import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Plus, Trophy, Brain, Frown, Trash2, BookHeart, Edit2, X, Sparkles, PenTool, FileText, Loader2, ImagePlus, Orbit, Smile } from 'lucide-react';
import { DiaryEntry } from '../types';
import { extractTextFromPDF } from '../lib/ai';

interface DiaryProps {
  entries: DiaryEntry[];
  onAddEntry: (entry: Omit<DiaryEntry, 'id' | 'date'>) => void;
  onEditEntry: (id: string, entry: Omit<DiaryEntry, 'id' | 'date'>) => void;
  onDeleteEntry: (id: string) => void;
  onBack: () => void;
}

type TabType = 'all' | DiaryEntry['type'];

export function Diary({ entries, onAddEntry, onEditEntry, onDeleteEntry, onBack }: DiaryProps) {
  const [text, setText] = useState('');
  const [type, setType] = useState<DiaryEntry['type']>('my universe');
  const [image, setImage] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#1a1a1a'); // Default black-ish
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isWriting, setIsWriting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const colors = [
    { name: 'Black', value: '#1a1a1a' },
    { name: 'Blue', value: '#2563eb' },
    { name: 'Red', value: '#dc2626' },
    { name: 'Green', value: '#16a34a' },
    { name: 'Purple', value: '#9333ea' },
    { name: 'Pink', value: '#db2777' },
    { name: 'Orange', value: '#ea580c' },
    { name: 'Brown', value: '#78350f' },
    { name: 'Teal', value: '#0d9488' },
  ];

  const handleColorChange = (color: string) => {
    setSelectedColor(color);
    if (isWriting) {
      document.execCommand('foreColor', false, color);
      editorRef.current?.focus();
    }
  };

  const handleFormat = (command: string) => {
    if (isWriting) {
      document.execCommand(command, false);
      editorRef.current?.focus();
    }
  };

  const insertEmoji = (emoji: string) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertText', false, emoji);
      setShowEmojiPicker(false);
    }
  };

  const emojis = ['❤️', '✨', '😊', '🌟', '🌸', '🦋', '🌙', '☁️', '🍃', '🧸', '🎀', '🍭', '🎨', '📚', '🏡', '💭', '🔥', '🌈', '🍕', '🐱'];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        
        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
        
        // Check size (approximate base64 size to bytes)
        const sizeInBytes = Math.round((compressedBase64.length * 3) / 4);
        if (sizeInBytes > 900000) { // Keep under ~900KB to be safe for Firestore 1MB limit
          alert('Image is still too large after compression. Please choose a smaller image.');
          return;
        }
        
        setImage(compressedBase64);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    
    if (imageInputRef.current) {
      imageInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file.');
      return;
    }

    setIsExtracting(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const extractedText = await extractTextFromPDF(base64Data);
          setText((prev) => prev ? prev + '\n\n' + extractedText : extractedText);
          setIsExtracting(false);
        } catch (err: any) {
          console.error('Error extracting text:', err);
          alert(err.message || 'Failed to extract text from PDF.');
          setIsExtracting(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read PDF file.');
      setIsExtracting(false);
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = editorRef.current?.innerHTML || '';
    if (content.trim() && content !== '<br>') {
      if (editingId) {
        onEditEntry(editingId, { text: content.trim(), type, image, title: title.trim() || undefined, color: selectedColor });
        setEditingId(null);
      } else {
        onAddEntry({ text: content.trim(), type, image, title: title.trim() || undefined, color: selectedColor });
      }
      setText('');
      setType('my universe');
      setImage(undefined);
      setTitle('');
      setSelectedColor('#1a1a1a');
      setIsWriting(false);
    }
  };

  const handleEditClick = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setText(entry.text);
    setType(entry.type);
    setImage(entry.image);
    setTitle(entry.title || '');
    setSelectedColor(entry.color || '#1a1a1a');
    setIsWriting(true);
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = entry.text;
      }
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setText('');
    setType('my universe');
    setImage(undefined);
    setTitle('');
    setSelectedColor('#1a1a1a');
    setIsWriting(false);
  };

  const getIcon = (t: DiaryEntry['type']) => {
    switch (t) {
      case 'achievement': return <Trophy className="w-5 h-5" />;
      case 'my story': return <Frown className="w-5 h-5" />;
      default: return <Orbit className="w-5 h-5" />;
    }
  };

  const filteredEntries = entries.filter(e => {
    const matchesSearch = (e.text || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (e.title || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = activeTab === 'all' || 
                       (activeTab === 'my universe' && (e.type === 'my universe' || (e.type as string) === 'thought')) ||
                       e.type === activeTab;
    return matchesSearch && matchesType;
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-6xl mx-auto w-full h-[90vh] flex flex-col md:flex-row gap-8"
    >
      {/* Sidebar / Navigation */}
      <div className="w-full md:w-64 flex flex-col shrink-0 bg-[#3d2b1f] p-6 rounded-[2rem] border-r-4 border-[#2a1d15] shadow-2xl relative overflow-hidden">
        {/* Leather texture effect */}
        <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ backgroundImage: 'url("https://www.transparenttextures.com/patterns/leather.png")' }} />
        
        <div className="relative z-10">
          <div className="flex items-center mb-8">
            <button onClick={onBack} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors mr-4">
              <ArrowLeft className="w-6 h-6 text-white" />
            </button>
            <h1 className="text-2xl font-serif italic text-[#e5d5c5] flex items-center gap-2">
              <BookHeart className="w-6 h-6 text-rose-400" />
              My Diary
            </h1>
          </div>

          <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-4 md:pb-0">
            <div className="relative mb-2 hidden md:block">
              <input
                type="text"
                placeholder="Search entries..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-rose-400/50 text-sm"
              />
            </div>
            {(['all', 'my universe', 'achievement', 'my story'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap ${
                  activeTab === t 
                    ? 'bg-[#e5d5c5] text-[#3d2b1f] shadow-inner font-bold' 
                    : 'text-[#e5d5c5]/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                {t === 'all' ? <Sparkles className="w-5 h-5" /> : getIcon(t as DiaryEntry['type'])}
                <span className="font-medium capitalize tracking-wide">{t}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              if (activeTab !== 'all') setType(activeTab);
              setIsWriting(true);
            }}
            className="mt-4 md:mt-8 w-full flex items-center justify-center gap-2 px-6 py-4 bg-[#e5d5c5] text-[#3d2b1f] rounded-xl font-bold hover:bg-white transition-all shadow-lg transform hover:-translate-y-1 active:translate-y-0"
          >
            <PenTool className="w-5 h-5" />
            Write Entry
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-[#fffcf0] rounded-[2rem] border border-white/5 shadow-2xl overflow-hidden relative flex flex-col">
        {/* Book binding effect */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-black/20 via-black/5 to-transparent z-10 pointer-events-none" />
        <div className="absolute left-6 top-0 bottom-0 w-px bg-rose-200/50 z-10 pointer-events-none" />
        
        <div className="flex-1 overflow-y-auto p-8 md:p-16 relative z-0">
          <AnimatePresence mode="wait">
            {isWriting ? (
              <motion.div
                key="writing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                ref={formRef}
                className="max-w-2xl mx-auto"
              >
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-3xl font-serif italic text-[#3d2b1f]">
                    {editingId ? 'Revise Entry' : 'Dear Diary...'}
                  </h2>
                  <div className="flex items-center gap-4">
                    {/* Color Picker */}
                    <div className="flex gap-2 bg-black/5 p-2 rounded-full">
                      {colors.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => handleColorChange(c.value)}
                          className={`w-6 h-6 rounded-full border-2 transition-all ${
                            selectedColor === c.value ? 'scale-125 border-white shadow-md' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c.value }}
                          title={`${c.name} Pen`}
                        />
                      ))}
                    </div>
                    <button onClick={cancelEdit} className="p-2 text-[#3d2b1f]/40 hover:text-[#3d2b1f] rounded-full hover:bg-black/5 transition-colors">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                  {image && (
                    <div className="relative w-full max-w-md mx-auto mb-4 group">
                      <img src={image} alt="Diary entry" className="w-full h-auto rounded-xl object-cover border border-black/10 shadow-lg" />
                      <button
                        type="button"
                        onClick={() => { setImage(undefined); setTitle(''); }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-black/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="What is this photo about?"
                        className="w-full mt-3 bg-black/5 border border-black/10 rounded-xl px-4 py-2 text-[#3d2b1f] placeholder-[#3d2b1f]/40 focus:outline-none focus:border-rose-500/50"
                        required={!!image}
                      />
                    </div>
                  )}

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-wrap items-center gap-2 p-2 bg-black/5 rounded-xl border border-black/5">
                      <div className="flex gap-1 pr-2 border-r border-black/10">
                        <button
                          type="button"
                          onClick={() => handleFormat('bold')}
                          className="p-2 hover:bg-black/10 rounded-lg transition-colors"
                          title="Bold"
                        >
                          <span className="font-bold">B</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFormat('italic')}
                          className="p-2 hover:bg-black/10 rounded-lg transition-colors"
                          title="Italic"
                        >
                          <span className="italic">I</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleFormat('underline')}
                          className="p-2 hover:bg-black/10 rounded-lg transition-colors"
                          title="Underline"
                        >
                          <span className="underline">U</span>
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-1.5 px-2 border-r border-black/10">
                        {colors.map((color) => (
                          <button
                            key={color.name}
                            type="button"
                            onClick={() => handleColorChange(color.value)}
                            className={`w-6 h-6 rounded-full border-2 transition-all ${
                              selectedColor === color.value ? 'border-black scale-110' : 'border-transparent'
                            }`}
                            style={{ backgroundColor: color.value }}
                            title={color.name}
                          />
                        ))}
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                          className={`p-2 rounded-lg transition-all ${
                            showEmojiPicker ? 'bg-rose-500/10 text-rose-600' : 'hover:bg-black/10 text-black/60'
                          }`}
                          title="Add Emoji"
                        >
                          <Smile className="w-5 h-5" />
                        </button>

                        <AnimatePresence>
                          {showEmojiPicker && (
                            <motion.div
                              initial={{ opacity: 0, y: 10, scale: 0.95 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: 10, scale: 0.95 }}
                              className="absolute bottom-full mb-4 left-0 bg-white border border-black/10 rounded-2xl p-3 shadow-2xl z-50 w-64 grid grid-cols-5 gap-2"
                            >
                              {emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => insertEmoji(emoji)}
                                  className="text-2xl hover:bg-black/5 p-2 rounded-lg transition-colors"
                                >
                                  {emoji}
                                </button>
                              ))}
                              <div className="absolute -bottom-2 left-6 w-4 h-4 bg-white border-r border-b border-black/10 rotate-45" />
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div className="relative min-h-[400px] bg-[#fffcf0] rounded-2xl p-8 shadow-inner border border-black/5">
                      {/* Lined paper effect */}
                      <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(transparent, transparent 31px, rgba(37,99,235,0.1) 31px, rgba(37,99,235,0.1) 32px)', backgroundAttachment: 'local' }} />
                      <div
                        ref={editorRef}
                        contentEditable
                        onInput={(e) => setText(e.currentTarget.innerHTML)}
                        className="w-full min-h-[350px] bg-transparent font-handwriting text-2xl leading-[32px] overflow-y-auto focus:outline-none placeholder-black/10 relative z-10 p-1 text-[#1a1a1a]"
                        onFocus={() => {
                          // Set the initial color if empty
                          if (editorRef.current?.innerHTML === '') {
                            document.execCommand('foreColor', false, selectedColor);
                          }
                        }}
                      />
                      {!text && (
                        <div className="absolute top-8 left-8 pointer-events-none font-handwriting text-2xl text-black/10 z-0">
                          Pour your heart out...
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between border-t border-black/10 pt-6">
                    <div className="flex gap-2 items-center flex-wrap">
                      {(['my universe', 'achievement', 'my story'] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${
                            type === t 
                              ? 'bg-rose-500/10 text-rose-700 border border-rose-500/20' 
                              : 'bg-black/5 text-black/40 border border-transparent hover:bg-black/10 hover:text-black/80'
                          }`}
                          title={`Mark as ${t}`}
                        >
                          {getIcon(t)}
                          <span className="text-sm font-medium capitalize hidden sm:inline">{t}</span>
                        </button>
                      ))}
                      
                      <div className="w-px h-8 bg-black/10 mx-2 hidden sm:block"></div>
                      
                      <input
                        type="file"
                        accept="image/*"
                        ref={imageInputRef}
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-2 p-3 rounded-xl bg-black/5 text-black/60 hover:bg-black/10 hover:text-black transition-all"
                        title="Add Photo"
                      >
                        <ImagePlus className="w-5 h-5" />
                        <span className="text-sm font-medium hidden sm:inline">Add Photo</span>
                      </button>

                      <input
                        type="file"
                        accept="application/pdf"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isExtracting}
                        className="flex items-center gap-2 p-3 rounded-xl bg-black/5 text-black/60 hover:bg-black/10 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Upload PDF"
                      >
                        {isExtracting ? <Loader2 className="w-5 h-5 animate-spin" /> : <FileText className="w-5 h-5" />}
                        <span className="text-sm font-medium hidden sm:inline">{isExtracting ? 'Extracting...' : 'Upload PDF'}</span>
                      </button>
                    </div>
                    <button
                      type="submit"
                      className="px-8 py-3 bg-[#3d2b1f] hover:bg-[#2a1d15] text-[#e5d5c5] rounded-xl font-bold transition-all shadow-lg shadow-black/20"
                    >
                      {editingId ? 'Save Changes' : 'Seal Entry'}
                    </button>
                  </div>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="reading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto flex flex-col gap-8"
              >
                {filteredEntries.length === 0 ? (
                  <div className="text-center py-20">
                    <BookHeart className="w-20 h-20 text-black/10 mx-auto mb-6" />
                    <h3 className="text-2xl font-serif italic text-black/40 mb-2">No entries found</h3>
                    <p className="text-black/30">
                      {activeTab === 'all' 
                        ? "Your diary is waiting for its first story." 
                        : `You haven't written any ${activeTab}s yet.`}
                    </p>
                  </div>
                ) : (
                  filteredEntries.map((entry) => (
                    <motion.div
                      key={entry.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative"
                    >
                      <div className="flex items-baseline gap-4 mb-3">
                        <span className="text-sm font-medium tracking-widest uppercase text-rose-600/80">
                          {new Date(entry.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <div className="h-[1px] flex-1 bg-gradient-to-r from-black/10 to-transparent" />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditClick(entry)}
                            className="p-1.5 text-black/40 hover:text-indigo-600 hover:bg-indigo-500/10 rounded-md transition-colors"
                            title="Edit Entry"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteEntry(entry.id)}
                            className="p-1.5 text-black/40 hover:text-red-600 hover:bg-red-400/10 rounded-md transition-colors"
                            title="Delete Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="pl-4 border-l-2 border-black/5 relative">
                        <div className="absolute -left-[11px] top-2 p-1 bg-[#fffcf0] rounded-full text-black/40 border border-black/10">
                          {React.cloneElement(getIcon(entry.type) as React.ReactElement<any>, { className: 'w-3 h-3' })}
                        </div>
                        {entry.image && (
                          <div className="mb-6">
                            <img src={entry.image} alt={entry.title || 'Diary entry'} className="w-full max-w-md h-auto rounded-xl object-cover border border-black/10 shadow-lg" />
                            {entry.title && (
                              <p className="mt-2 text-sm font-medium text-black/50 italic">
                                {entry.title}
                              </p>
                            )}
                          </div>
                        )}
                        <div 
                          className="font-handwriting text-2xl leading-relaxed whitespace-pre-wrap text-[#1a1a1a]"
                          dangerouslySetInnerHTML={{ __html: entry.text }}
                        />
                        <div className="mt-4 font-handwriting text-xl text-black/20 italic">
                          ~ {entry.type}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
