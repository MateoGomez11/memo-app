import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Meeting } from '../types';

const MEETINGS_KEY = 'memo_meetings';
const API_KEY_KEY = 'memo_gemini_api_key';

export async function saveMeeting(meeting: Meeting): Promise<void> {
  const existing = await getMeetings();
  const updated = [meeting, ...existing.filter((m) => m.id !== meeting.id)];
  await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(updated));
}

export async function getMeetings(): Promise<Meeting[]> {
  const raw = await AsyncStorage.getItem(MEETINGS_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as Meeting[];
}

export async function getMeeting(id: string): Promise<Meeting | null> {
  const meetings = await getMeetings();
  return meetings.find((m) => m.id === id) ?? null;
}

export async function deleteMeeting(id: string): Promise<void> {
  const existing = await getMeetings();
  await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(existing.filter((m) => m.id !== id)));
}

export async function updateActionItem(meetingId: string, actionItemId: string, done: boolean): Promise<void> {
  const meetings = await getMeetings();
  const updated = meetings.map((m) => {
    if (m.id !== meetingId) return m;
    return { ...m, actionItems: m.actionItems.map((ai) => ai.id === actionItemId ? { ...ai, done } : ai) };
  });
  await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(updated));
}

export async function updateMeetingTitle(id: string, title: string): Promise<void> {
  const meetings = await getMeetings();
  const updated = meetings.map((m) => m.id === id ? { ...m, title } : m);
  await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(updated));
}

export async function toggleMeetingFavorite(id: string): Promise<boolean> {
  const meetings = await getMeetings();
  let newFav = false;
  const updated = meetings.map((m) => {
    if (m.id !== id) return m;
    newFav = !m.favorite;
    return { ...m, favorite: newFav };
  });
  await AsyncStorage.setItem(MEETINGS_KEY, JSON.stringify(updated));
  return newFav;
}

export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_KEY, key);
}

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_KEY);
}

export async function deleteApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(API_KEY_KEY);
}

const SETTINGS_KEY = 'memo_app_settings';

export interface AppSettings {
  language: 'es' | 'en';
  themeMode: 'light' | 'dark';
}

const DEFAULT_SETTINGS: AppSettings = { language: 'es', themeMode: 'light' };

export async function getAppSettings(): Promise<AppSettings> {
  const raw = await AsyncStorage.getItem(SETTINGS_KEY);
  if (!raw) return DEFAULT_SETTINGS;
  return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  const current = await getAppSettings();
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

const ACTIVE_RECORDING_KEY = 'memo_active_recording';

export interface ActiveRecordingData {
  uri: string;
  startedAt: number;
  title: string;
}

export async function saveActiveRecording(data: ActiveRecordingData): Promise<void> {
  await AsyncStorage.setItem(ACTIVE_RECORDING_KEY, JSON.stringify(data));
}

export async function clearActiveRecording(): Promise<void> {
  await AsyncStorage.removeItem(ACTIVE_RECORDING_KEY);
}

export async function getActiveRecording(): Promise<ActiveRecordingData | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_RECORDING_KEY);
  if (!raw) return null;
  return JSON.parse(raw) as ActiveRecordingData;
}
