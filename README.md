# Memo — AI Meeting Recorder

> Record, transcribe, and analyze meetings from your phone. Powered by Gemini 2.5 Flash.

Memo is a React Native mobile app that records audio in the background, sends it to Google Gemini for full transcription and structured analysis, and stores the results locally. No subscription required — users bring their own API key or configure one at org level.

---

## Features

- **Background recording** — Android foreground service keeps recording while the app is minimized, with a persistent notification and pause/resume controls
- **Audio import** — Pick any audio file from device storage and process it the same way as a live recording
- **AI analysis** — Gemini 2.5 Flash returns a structured summary: TLDR, key points, action items (with assignee + due date), pending dates, full transcript, confidence score, and detected attendees
- **Folder organization** — Create color-coded folders and assign memos to them; built-in Favorites folder auto-populated from starred memos
- **Categories** — Work, Personal, Draft; auto-assigned by the AI or editable manually
- **Offline resilience** — If there's no internet when stopping, the recording is saved locally as a Draft and can be processed later
- **Authentication** — Email/password and Google OAuth via Supabase
- **Dark / light mode** — Full Material You-style theme system
- **Multilingual** — Spanish and English, auto-detected from device locale

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| Navigation | React Navigation v7 |
| Auth & backend | Supabase |
| AI | Google Gemini 2.5 Flash |
| Local storage | AsyncStorage |
| Audio | expo-av + expo-audio |
| Animations | React Native Reanimated v4 |
| Native module | Custom Expo Module (Android foreground service) |
| Build & distribution | EAS Build |

---

## Project Structure

```
src/
├── screens/
│   ├── HomeScreen.tsx          # Memo list, folder tabs, search
│   ├── ActiveRecordingScreen.tsx
│   ├── ImportAudioScreen.tsx
│   ├── ProcessingScreen.tsx    # Upload + AI progress
│   ├── MeetingSummaryScreen.tsx
│   ├── LoginScreen.tsx
│   └── ApiKeySetupScreen.tsx
├── components/
│   ├── MemoCard.tsx            # Card with context menu (move, favorite, delete)
│   ├── BottomNav.tsx
│   └── TopBar.tsx
├── services/
│   ├── gemini.ts               # Audio upload + Gemini API call
│   ├── storage.ts              # AsyncStorage CRUD (meetings + folders)
│   └── supabase.ts
├── context/AppContext.tsx      # Theme, locale, auth state
├── i18n/index.ts               # ES / EN translations
└── types/index.ts
modules/
└── recording-service/          # Custom Expo Module: Android FGS
    └── android/src/main/java/expo/modules/recordingservice/
        ├── RecordingServiceModule.kt
        └── RecordingForegroundService.kt
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Android Studio or a physical Android device

### Installation

```bash
git clone https://github.com/MateoGomez11/memo-app.git
cd memo-app
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key
EXPO_PUBLIC_GROQ_API_KEY=your_groq_api_key
```

> For EAS builds, add `GEMINI_API_KEY` and `GROQ_API_KEY` as EAS Secrets (`eas secret:create`) — never commit them to `eas.json`.

### Run locally

```bash
# Start Metro
expo start

# Run on Android (requires dev build)
eas build --profile development --platform android
```

### Build for distribution

```bash
# Internal testing APK
eas build --profile preview --platform android

# Production AAB
eas build --profile production --platform android
```

---

## How It Works

```
Record / Import audio
        │
        ▼
expo-av captures .m4a → stored in documentDirectory
        │
        ▼
Base64 encode → Gemini 2.5 Flash API (audio/m4a)
        │
        ▼
Structured JSON: title, TLDR, keyPoints, actionItems,
                 pendingDates, transcript, attendees, category
        │
        ▼
Saved to AsyncStorage → rendered in MeetingSummaryScreen
```

---

## License

MIT
