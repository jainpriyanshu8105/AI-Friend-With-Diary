import React, { useState, useEffect } from 'react';
import { Home } from './components/Home';
import { Dashboard } from './components/Dashboard';
import { Diary } from './components/Diary';
import { Talk } from './components/Talk';
import { Games } from './components/Games';
import { AdminPanel } from './components/AdminPanel';
import { generateChatResponse } from './lib/ai';
import { FriendSetup } from './components/FriendSetup';
import { UserData, DiaryEntry, ChatMessage, AIProfile } from './types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, onSnapshot, query, orderBy, addDoc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { Settings, ShieldAlert } from 'lucide-react';

type View = 'home' | 'dashboard' | 'diary' | 'talk' | 'games';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: any }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      try {
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error) errorMessage = parsed.error;
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-2xl max-w-md">
            <h2 className="text-xl font-semibold text-red-400 mb-2">Application Error</h2>
            <p className="text-slate-400 mb-4">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}

function AppContent() {
  const [view, setView] = useState<View>('home');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [audioCache, setAudioCache] = useState<Record<string, string>>({});
  const [isTyping, setIsTyping] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [isSandboxMode, setIsSandboxMode] = useState(() => {
    return localStorage.getItem('STRESS_BUSTER_SANDBOX_ACTIVE') === 'true';
  });

  const isAdmin = auth.currentUser?.email === 'jainpriyanshu8105@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setIsSandboxMode(false);
          localStorage.removeItem('STRESS_BUSTER_SANDBOX_ACTIVE');
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (userDoc.exists() && userDoc.data().isBlocked) {
            setIsBlocked(true);
            setUserData(null);
            setIsAuthReady(true);
            return;
          }

          setIsBlocked(false);
          
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              name: user.displayName || 'User',
              email: user.email,
              createdAt: new Date().toISOString()
            });
          }
          
          setUserData({
            name: userDoc.exists() ? userDoc.data().name : (user.displayName || 'User'),
            aiFriend: userDoc.exists() ? userDoc.data().aiFriend : undefined,
            diaryEntries: [],
            chatHistory: [],
            reminders: []
          });
          setView('dashboard');
        } else {
          if (!isSandboxMode) {
            setUserData(null);
            setView('home');
          }
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        // We don't throw here to avoid hanging the app
      } finally {
        setIsAuthReady(true);
      }
    });

    return () => unsubscribe();
  }, [isSandboxMode]);

  // Load Guest / Sandbox data
  useEffect(() => {
    if (!isSandboxMode) return;
    
    // Load local sandbox profile
    const savedProfile = localStorage.getItem('STRESS_BUSTER_GUEST_PROFILE');
    const guestProfile = savedProfile ? JSON.parse(savedProfile) : {
      name: 'Guest Explorer',
      aiFriend: undefined,
    };

    const savedDiary = localStorage.getItem('STRESS_BUSTER_GUEST_DIARY');
    const diaryEntries = savedDiary ? JSON.parse(savedDiary) : [];

    const savedChat = localStorage.getItem('STRESS_BUSTER_GUEST_CHAT');
    const chatHistory = savedChat ? JSON.parse(savedChat) : [];

    const savedReminders = localStorage.getItem('STRESS_BUSTER_GUEST_REMINDERS');
    const reminders = savedReminders ? JSON.parse(savedReminders) : [];

    setUserData({
      name: guestProfile.name,
      aiFriend: guestProfile.aiFriend,
      diaryEntries,
      chatHistory,
      reminders
    });
    
    setIsAuthReady(true);
    setView('dashboard');
  }, [isSandboxMode]);

  useEffect(() => {
    if (!isAuthReady || !auth.currentUser || isSandboxMode) return;

    const uid = auth.currentUser.uid;
    
    const diaryQuery = query(collection(db, `users/${uid}/diaryEntries`));
    const unsubDiary = onSnapshot(diaryQuery, (snapshot) => {
      const entries: DiaryEntry[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Fallback for potential missing text field from older versions
        const text = data.text || data.content || data.body || data.thought || '';
        entries.push({ id: doc.id, ...data, text } as DiaryEntry);
      });
      // Sort by date descending
      entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setUserData(prev => prev ? { ...prev, diaryEntries: entries } : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/diaryEntries`);
    });

    const chatQuery = query(collection(db, `users/${uid}/chatHistory`), orderBy('timestamp', 'asc'));
    const unsubChat = onSnapshot(chatQuery, (snapshot) => {
      const messages: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        messages.push(doc.data() as ChatMessage);
      });
      setUserData(prev => prev ? { ...prev, chatHistory: messages } : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/chatHistory`);
    });

    const remindersQuery = query(collection(db, `users/${uid}/reminders`));
    const unsubReminders = onSnapshot(remindersQuery, (snapshot) => {
      const reminders: any[] = [];
      snapshot.forEach((doc) => {
        reminders.push({ id: doc.id, ...doc.data() });
      });
      setUserData(prev => prev ? { ...prev, reminders } : null);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/reminders`);
    });

    return () => {
      unsubDiary();
      unsubChat();
      unsubReminders();
    };
  }, [isAuthReady, auth.currentUser?.uid]);

  useEffect(() => {
    if (!isAuthReady || !auth.currentUser || !userData || !userData.diaryEntries) return;
    
    const migrateEntries = async () => {
      const uid = auth.currentUser!.uid;
      
      // 1. Migrate 'thought' to 'my universe'
      const oldTypeEntries = userData.diaryEntries.filter(e => (e.type as string) === 'thought');
      if (oldTypeEntries.length > 0) {
        console.log(`Migrating ${oldTypeEntries.length} entries from 'thought' to 'my universe'...`);
        for (const entry of oldTypeEntries) {
          try {
            const entryRef = doc(db, `users/${uid}/diaryEntries`, entry.id);
            await updateDoc(entryRef, { type: 'my universe' });
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `users/${uid}/diaryEntries/${entry.id}`);
          }
        }
      }

      // 2. Ensure 'text' field exists if it was saved as something else
      const missingTextEntries = userData.diaryEntries.filter(e => !e.text && (e as any).content);
      if (missingTextEntries.length > 0) {
        console.log(`Migrating ${missingTextEntries.length} entries with missing 'text' field...`);
        for (const entry of missingTextEntries) {
          try {
            const entryRef = doc(db, `users/${uid}/diaryEntries`, entry.id);
            await updateDoc(entryRef, { text: (entry as any).content });
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `users/${uid}/diaryEntries/${entry.id}`);
          }
        }
      }
    };

    migrateEntries();
  }, [isAuthReady, auth.currentUser?.uid, userData?.diaryEntries?.length]);

  useEffect(() => {
    if (!userData || !userData.reminders || (!auth.currentUser && !isSandboxMode)) return;
    
    const checkReminders = async () => {
      const now = new Date();
      const pendingReminders = userData.reminders.filter(r => r.status === 'pending');
      
      for (const reminder of pendingReminders) {
        const reminderTime = new Date(reminder.time);
        if (now >= reminderTime) {
          // Trigger reminder
          try {
            // 1. Update status
            if (isSandboxMode) {
              setUserData(prev => {
                if (!prev) return null;
                const updatedReminders = prev.reminders.map(r => r.id === reminder.id ? { ...r, status: 'sent' as const } : r);
                localStorage.setItem('STRESS_BUSTER_GUEST_REMINDERS', JSON.stringify(updatedReminders));
                return { ...prev, reminders: updatedReminders };
              });
            } else {
              const reminderRef = doc(db, `users/${auth.currentUser!.uid}/reminders`, reminder.id);
              await updateDoc(reminderRef, { status: 'sent' });
            }
            
            // 2. Add chat message from AI
            if (userData.aiFriend) {
              const modelMessage: Partial<ChatMessage> = { 
                role: 'model', 
                text: `🔔 **Reminder:**\n\n${reminder.message}`, 
                timestamp: Date.now(), 
                friendType: userData.aiFriend.type,
              };
              
              if (isSandboxMode) {
                setUserData(prev => {
                  if (!prev) return null;
                  const updatedChat = [...prev.chatHistory, modelMessage as ChatMessage];
                  localStorage.setItem('STRESS_BUSTER_GUEST_CHAT', JSON.stringify(updatedChat));
                  return { ...prev, chatHistory: updatedChat };
                });
              } else {
                await addDoc(collection(db, `users/${auth.currentUser!.uid}/chatHistory`), modelMessage);
                
                // 2.1 Send Email via Resend
                if (auth.currentUser?.email) {
                  fetch('/api/send-reminder-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      email: auth.currentUser.email,
                      message: reminder.message,
                      aiFriendName: userData.aiFriend.name
                    })
                  }).catch(err => console.error("Failed to send reminder email:", err));
                }
              }
            }
            
            // 3. Show browser notification if permitted
            if (Notification.permission === 'granted') {
              new Notification('New Reminder from ' + (userData.aiFriend?.name || 'AI Friend'), {
                body: reminder.message,
                icon: '/favicon.ico'
              });
            } else if (Notification.permission !== 'denied') {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  new Notification('New Reminder from ' + (userData.aiFriend?.name || 'AI Friend'), {
                    body: reminder.message,
                    icon: '/favicon.ico'
                  });
                }
              });
            }
          } catch (e) {
            if (!isSandboxMode) {
              handleFirestoreError(e, OperationType.WRITE, `users/${auth.currentUser!.uid}/reminders/${reminder.id}`);
            } else {
              console.error("Sandbox reminder error:", e);
            }
          }
        }
      }
    };

    const interval = setInterval(checkReminders, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [userData, auth.currentUser, isSandboxMode]);

  const handleLogout = () => {
    if (isSandboxMode) {
      setIsSandboxMode(false);
      localStorage.removeItem('STRESS_BUSTER_SANDBOX_ACTIVE');
      setUserData(null);
      setView('home');
    } else {
      signOut(auth);
    }
  };

  const handleAddDiaryEntry = async (entry: Omit<DiaryEntry, 'id' | 'date'>) => {
    if (isSandboxMode) {
      const newEntry: DiaryEntry = {
        ...entry,
        id: Date.now().toString(),
        date: new Date().toISOString()
      } as DiaryEntry;
      setUserData(prev => {
        if (!prev) return null;
        const updatedDiary = [newEntry, ...prev.diaryEntries];
        localStorage.setItem('STRESS_BUSTER_GUEST_DIARY', JSON.stringify(updatedDiary));
        return { ...prev, diaryEntries: updatedDiary };
      });
      return;
    }

    if (!auth.currentUser) return;
    try {
      // Remove undefined fields
      const cleanEntry = Object.fromEntries(
        Object.entries(entry).filter(([_, v]) => v !== undefined)
      );
      
      const newEntry = {
        ...cleanEntry,
        date: new Date().toISOString(),
      };
      await addDoc(collection(db, `users/${auth.currentUser.uid}/diaryEntries`), newEntry);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}/diaryEntries`);
    }
  };

  const handleEditDiaryEntry = async (id: string, updatedEntry: Omit<DiaryEntry, 'id' | 'date'>) => {
    if (isSandboxMode) {
      setUserData(prev => {
        if (!prev) return null;
        const updatedDiary = prev.diaryEntries.map(e => e.id === id ? { ...e, ...updatedEntry } as DiaryEntry : e);
        localStorage.setItem('STRESS_BUSTER_GUEST_DIARY', JSON.stringify(updatedDiary));
        return { ...prev, diaryEntries: updatedDiary };
      });
      return;
    }

    if (!auth.currentUser) return;
    try {
      // Remove undefined fields
      const cleanEntry = Object.fromEntries(
        Object.entries(updatedEntry).filter(([_, v]) => v !== undefined)
      );
      
      const entryRef = doc(db, `users/${auth.currentUser.uid}/diaryEntries`, id);
      await updateDoc(entryRef, cleanEntry);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}/diaryEntries/${id}`);
    }
  };

  const handleDeleteDiaryEntry = async (id: string) => {
    if (isSandboxMode) {
      setUserData(prev => {
        if (!prev) return null;
        const updatedDiary = prev.diaryEntries.filter(e => e.id !== id);
        localStorage.setItem('STRESS_BUSTER_GUEST_DIARY', JSON.stringify(updatedDiary));
        return { ...prev, diaryEntries: updatedDiary };
      });
      return;
    }

    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `users/${auth.currentUser.uid}/diaryEntries`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${auth.currentUser.uid}/diaryEntries/${id}`);
    }
  };

  const handleSetAiFriend = async (type: 'girl' | 'boy', name: string, profileId?: string) => {
    if (isSandboxMode) {
      const aiFriend = { type, name, profileId };
      setUserData(prev => {
        if (!prev) return null;
        const updatedProfile = { ...prev, aiFriend };
        localStorage.setItem('STRESS_BUSTER_GUEST_PROFILE', JSON.stringify({ name: prev.name, aiFriend }));
        return updatedProfile;
      });
      return;
    }

    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const aiFriend: any = { type, name };
      if (profileId) aiFriend.profileId = profileId;
      
      await updateDoc(userRef, { aiFriend });
      setUserData(prev => prev ? { ...prev, aiFriend } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
    }
  };

  const handleAddReminder = async (time: string, message: string) => {
    if (isSandboxMode) {
      const newReminder = {
        id: Date.now().toString(),
        time,
        message,
        status: 'pending' as const,
        createdAt: Date.now()
      };
      setUserData(prev => {
        if (!prev) return null;
        const updatedReminders = [newReminder, ...prev.reminders];
        localStorage.setItem('STRESS_BUSTER_GUEST_REMINDERS', JSON.stringify(updatedReminders));
        return { ...prev, reminders: updatedReminders };
      });
      return;
    }

    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, `users/${auth.currentUser.uid}/reminders`), {
        time,
        message,
        status: 'pending',
        createdAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${auth.currentUser.uid}/reminders`);
    }
  };

  const handleSendMessage = async (text: string, audioData?: string, imageData?: string) => {
    if (!isSandboxMode && (!auth.currentUser || !userData || !userData.aiFriend)) return;
    if (isSandboxMode && (!userData || !userData.aiFriend)) return;
    
    const uid = isSandboxMode ? 'guest' : auth.currentUser!.uid;
    const userMessage: Partial<ChatMessage> = { 
      role: 'user', 
      text: text || (imageData ? '🖼️ Sent a Photo' : '🎤 Voice Message'), 
      timestamp: Date.now(), 
      friendType: userData.aiFriend.type 
    };
    if (imageData) {
      userMessage.imageUrl = imageData;
    }
    
    setIsTyping(true);
    
    try {
      let docId = Date.now().toString();
      if (isSandboxMode) {
        setUserData(prev => {
          if (!prev) return null;
          const updatedChat = [...prev.chatHistory, { ...userMessage, id: docId } as ChatMessage];
          localStorage.setItem('STRESS_BUSTER_GUEST_CHAT', JSON.stringify(updatedChat));
          return { ...prev, chatHistory: updatedChat };
        });
      } else {
        const docRef = await addDoc(collection(db, `users/${uid}/chatHistory`), userMessage);
        docId = docRef.id;
      }

      if (audioData) {
        setAudioCache(prev => ({ ...prev, [docId]: audioData }));
      }
      
      const userMessageWithMedia = { ...userMessage, id: docId, audioUrl: audioData, imageUrl: imageData };
      const newHistory = [...userData.chatHistory, userMessageWithMedia as ChatMessage];
      
      const response = await generateChatResponse(
        userData.name,
        userData.aiFriend,
        userData.diaryEntries,
        newHistory.filter(msg => (msg.friendType || 'girl') === userData.aiFriend?.type),
        text,
        audioData,
        imageData
      );
      
      let responseText = response.text;
      let imageId: string | undefined = undefined;
      
      const imageMatch = responseText.match(/\[SHOW_IMAGE:([^\]]+)\]/);
      if (imageMatch) {
        imageId = imageMatch[1];
        responseText = responseText.replace(/\[SHOW_IMAGE:[^\]]+\]/g, '').trim();
      }
      
      const reminderMatch = responseText.match(/\[SET_REMINDER:\s*([^|\]]+)(?:\|\s*([^\]]+))?\]/);
      if (reminderMatch) {
        const timeStr = reminderMatch[1].trim();
        const messageStr = (reminderMatch[2] || "Reminder!").trim();
        responseText = responseText.replace(/\[SET_REMINDER:[^\]]+\]/g, '').trim();
        
        try {
          const reminderTime = new Date(timeStr);
          const now = new Date();
          
          if (!isNaN(reminderTime.getTime()) && reminderTime > now) {
            await handleAddReminder(timeStr, messageStr);
          } else {
            console.warn("AI tried to set an invalid or past reminder:", timeStr);
          }
        } catch (e) {
          console.error("Failed to parse reminder time", e);
        }
      }
      
      const modelMessage: Partial<ChatMessage> = { 
        role: 'model', 
        text: responseText, 
        timestamp: Date.now(), 
        friendType: userData.aiFriend.type,
      };
      
      if (imageId) {
        modelMessage.imageId = imageId;
      }
      
      let modelDocId = (Date.now() + 1).toString();
      if (isSandboxMode) {
        setUserData(prev => {
          if (!prev) return null;
          const updatedChat = [...prev.chatHistory, { ...modelMessage, id: modelDocId } as ChatMessage];
          localStorage.setItem('STRESS_BUSTER_GUEST_CHAT', JSON.stringify(updatedChat));
          return { ...prev, chatHistory: updatedChat };
        });
      } else {
        const modelDocRef = await addDoc(collection(db, `users/${uid}/chatHistory`), modelMessage);
        modelDocId = modelDocRef.id;
      }

      if (response.audioUrl) {
        setAudioCache(prev => ({ ...prev, [modelDocId]: response.audioUrl }));
      }
      
    } catch (error) {
      if (!isSandboxMode) {
        handleFirestoreError(error, OperationType.CREATE, `users/${uid}/chatHistory`);
      } else {
        console.error("Sandbox message generation error:", error);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = async () => {
    if (isSandboxMode && userData && userData.aiFriend) {
      setUserData(prev => {
        if (!prev) return null;
        const updatedChat = prev.chatHistory.filter(msg => (msg.friendType || 'girl') !== userData.aiFriend?.type);
        localStorage.setItem('STRESS_BUSTER_GUEST_CHAT', JSON.stringify(updatedChat));
        return { ...prev, chatHistory: updatedChat };
      });
      return;
    }

    if (!auth.currentUser || !userData || !userData.aiFriend) return;
    
    const uid = auth.currentUser.uid;
    try {
      const chatQuery = query(collection(db, `users/${uid}/chatHistory`));
      const snapshot = await getDocs(chatQuery);
      
      const deletePromises = snapshot.docs
        .filter(doc => (doc.data().friendType || 'girl') === userData.aiFriend?.type)
        .map(doc => deleteDoc(doc.ref));
        
      await Promise.all(deletePromises);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${uid}/chatHistory`);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
        <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-3xl max-w-md backdrop-blur-xl">
          <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-red-500/20">
            <ShieldAlert className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Account Blocked</h2>
          <p className="text-slate-400 mb-8">Your account has been temporarily blocked by the administrator. Please contact support if you believe this is a mistake.</p>
          <button 
            onClick={handleLogout}
            className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-xl transition-all font-semibold text-white border border-white/10"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] font-sans text-slate-50 p-4 sm:p-8">
      {view === 'home' && (
        
        <Home 
          onSandboxMode={() => {
            setIsSandboxMode(true);
            localStorage.setItem('STRESS_BUSTER_SANDBOX_ACTIVE', 'true');
          }} 
        />
      )}
      
      {view === 'dashboard' && userData && (
        <>
          <div className="absolute top-4 right-4 flex items-center gap-4">
            {isAdmin && (
              <button 
                onClick={() => setShowAdminPanel(true)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-indigo-400"
                title="Admin Panel"
              >
                <Settings className="w-5 h-5" />
              </button>
            )}
            <button onClick={handleLogout} className="text-sm text-white/50 hover:text-white transition-colors">
              Sign Out
            </button>
          </div>
          <Dashboard name={userData.name} onNavigate={setView} />
        </>
      )}
      
      {showAdminPanel && <AdminPanel onClose={() => setShowAdminPanel(false)} />}
      
      {view === 'diary' && userData && (
        <Diary
          entries={userData.diaryEntries}
          onAddEntry={handleAddDiaryEntry}
          onEditEntry={handleEditDiaryEntry}
          onDeleteEntry={handleDeleteDiaryEntry}
          onBack={() => setView('dashboard')}
        />
      )}
      
      {view === 'talk' && userData && (
        <Talk
          name={userData.name}
          aiFriend={userData.aiFriend}
          onSetAiFriend={handleSetAiFriend}
          history={userData.chatHistory
            .filter(msg => (msg.friendType || 'girl') === userData.aiFriend?.type)
            .map(msg => ({ ...msg, audioUrl: msg.id && audioCache[msg.id] ? audioCache[msg.id] : msg.audioUrl }))}
          diaryEntries={userData.diaryEntries}
          reminders={userData.reminders}
          onAddReminder={handleAddReminder}
          onSendMessage={handleSendMessage}
          onClearChat={handleClearChat}
          onBack={() => setView('dashboard')}
          isTyping={isTyping}
        />
      )}

      {view === 'games' && (
        <Games onBack={() => setView('dashboard')} />
      )}
    </div>
  );
}
