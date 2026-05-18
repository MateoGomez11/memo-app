export interface PendingDate {
  description: string;
  date: string;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  createdAt: number;
}

export interface Meeting {
  id: string;
  title: string;
  date: string;
  duration: string;
  category: 'Work' | 'Personal' | 'Draft';
  tldr: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  pendingDates: PendingDate[];
  transcript: string;
  audioUri?: string;
  confidenceScore?: number;
  keyTheme?: string;
  attendees?: string;
  createdAt: number;
  favorite?: boolean;
  processed?: boolean;
  folderId?: string;
}

export interface ActionItem {
  id: string;
  text: string;
  assignee?: string;
  dueDate?: string;
  done: boolean;
}

export interface GeminiResult {
  title: string;
  tldr: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  pendingDates: PendingDate[];
  transcript: string;
  confidenceScore: number;
  keyTheme: string;
  attendees: string;
  duration: string;
  category: 'Work' | 'Personal' | 'Draft';
}

export type RootStackParamList = {
  Home: undefined;
  ActiveRecording: undefined;
  ImportAudio: undefined;
  Processing: { audioUri: string; title?: string; recordedDuration?: string; meetingId?: string };
  MeetingSummary: { meetingId: string };
  ApiKeySetup: undefined;
};
