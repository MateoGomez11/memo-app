import * as FileSystem from 'expo-file-system/legacy';
import { GeminiResult, ActionItem } from '../types';

const ENV_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

const ANALYSIS_PROMPT = `Eres un experto analista de reuniones. Se te dará un audio de una reunión. Transcríbelo completo y analízalo. Devuelve un objeto JSON con exactamente estos campos:

{
  "title": "título conciso de la reunión en español (máximo 8 palabras)",
  "category": "Work" | "Personal" | "Draft",
  "tldr": "resumen ejecutivo de maximo 6 oraciones en español, destacando los puntos más importantes y decisiones tomadas",
  "keyPoints": ["punto clave 1", "punto clave 2", "punto clave 3"],
  "actionItems": [
    { "text": "descripción de la tarea", "assignee": "nombre o vacío", "dueDate": "fecha o vacío" }
  ],
  "pendingDates": [
    { "description": "descripción del evento o compromiso mencionado", "date": "fecha exacta o relativa mencionada" }
  ],
  "transcript": "transcripción completa y literal del audio",
  "confidenceScore": 85,
  "keyTheme": "palabra o frase corta que resume el tema central en español",
  "attendees": "nombres separados por comas si son identificables, o cadena vacía",
  "duration": "duración estimada en formato MM:SS"
}

Extrae en pendingDates CUALQUIER fecha o compromiso temporal mencionado. Si no hay fechas, deja el array vacío.
Responde ÚNICAMENTE con JSON válido, sin markdown, sin bloques de código. Todo en español.`;

export async function processAudio(
  audioUri: string,
  apiKey: string,
  onProgress?: (pct: number) => void
): Promise<GeminiResult> {
  const effectiveKey = ENV_API_KEY || apiKey;

  onProgress?.(10);

  const base64Audio = await FileSystem.readAsStringAsync(audioUri, {
    encoding: 'base64',
  });

  onProgress?.(30);

  const mimeType = inferMimeType(audioUri);

  // Simulate progress while Gemini processes (can take 20-40s)
  let fakeProgress = 30;
  const timer = setInterval(() => {
    fakeProgress = Math.min(fakeProgress + 2, 75);
    onProgress?.(fakeProgress);
  }, 1000);

  try {
    const response = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${effectiveKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: ANALYSIS_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64Audio } },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      }
    );

    clearInterval(timer);
    onProgress?.(80);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Error de Gemini: ${err}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Respuesta vacía de Gemini');

    const parsed = JSON.parse(text) as any;
    onProgress?.(100);

    const actionItems: ActionItem[] = (parsed.actionItems ?? []).map((ai: any, i: number) => ({
      id: `ai_${Date.now()}_${i}`,
      text: ai.text ?? '',
      assignee: ai.assignee ?? '',
      dueDate: ai.dueDate ?? '',
      done: false,
    }));

    const pendingDates = (parsed.pendingDates ?? []).map((pd: any) => ({
      description: pd.description ?? '',
      date: pd.date ?? '',
    }));

    return {
      title: parsed.title ?? 'Reunión sin título',
      category: parsed.category ?? 'Work',
      tldr: parsed.tldr ?? '',
      keyPoints: parsed.keyPoints ?? [],
      actionItems,
      pendingDates,
      transcript: parsed.transcript ?? '',
      confidenceScore: parsed.confidenceScore ?? 0,
      keyTheme: parsed.keyTheme ?? '',
      attendees: parsed.attendees ?? '',
      duration: parsed.duration ?? '00:00',
    };
  } catch (e) {
    clearInterval(timer);
    throw e;
  }
}

function inferMimeType(uri: string): string {
  const lower = uri.toLowerCase();
  if (lower.endsWith('.ogg') || lower.endsWith('.oga')) return 'audio/ogg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.flac')) return 'audio/flac';
  if (lower.endsWith('.aac')) return 'audio/aac';
  return 'audio/mp4';
}
