import { UserData } from '../types';

const STORAGE_KEY = 'motivator_diary_data';

export function userExists(name: string): boolean {
  return localStorage.getItem(`${STORAGE_KEY}_${name}`) !== null;
}

export function loadUserData(name: string): UserData {
  const data = localStorage.getItem(`${STORAGE_KEY}_${name}`);
  if (data) {
    return JSON.parse(data);
  }
  return {
    name,
    diaryEntries: [],
    chatHistory: [],
    reminders: [],
  };
}

export function saveUserData(data: UserData) {
  localStorage.setItem(`${STORAGE_KEY}_${data.name}`, JSON.stringify(data));
}
