export interface DiaryEntry {
  id: string;
  date: string;
  text: string;
  type: 'achievement' | 'my universe' | 'my story';
  image?: string;
  title?: string;
  color?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'model';
  text: string;
  timestamp?: number;
  friendType?: 'girl' | 'boy';
  audioUrl?: string;
  imageUrl?: string;
  imageId?: string;
}

export interface Reminder {
  id: string;
  time: string;
  message: string;
  status: 'pending' | 'sent';
  createdAt: number;
}

export interface AIProfile {
  id: string;
  type: 'girl' | 'boy';
  location: string;
  bio: string;
  personality: string;
}

export interface UserData {
  name: string;
  password?: string;
  diaryEntries: DiaryEntry[];
  chatHistory: ChatMessage[];
  reminders: Reminder[];
  aiFriend?: {
    type: 'girl' | 'boy';
    name: string;
    profileId?: string;
  };
}
