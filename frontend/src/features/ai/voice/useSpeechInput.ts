import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';

/* Minimal typing for the Web Speech API (not in lib.dom for every TS version). */
interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface SpeechEvent { resultIndex: number; results: ArrayLike<SpeechResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SpeechEvent) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
}
type RecognitionCtor = new () => Recognition;

const Ctor = (): RecognitionCtor | undefined => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
// Brave ships the API but blocks the speech service behind it, so it records + transcribes on our server instead
const isBrave = () => !!(navigator as unknown as { brave?: unknown }).brave;
const canRecord = () => typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
const MAX_RECORD_MS = 120_000;

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow the microphone for this site in the address bar, then try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow the microphone for this site in the address bar, then try again.',
  NotAllowedError: 'Microphone access is blocked. Allow the microphone for this site in the address bar, then try again.',
  NotFoundError: 'No microphone found.',
  'no-speech': 'Didn’t hear anything. Click the mic and speak.',
  'audio-capture': 'No microphone found.',
  network: 'Voice typing could not reach the speech service. Try again.',
};

export type VoiceMode = 'live' | 'record' | 'none';

/**
 * Voice typing into a text box, appended after what was already typed.
 * 'live' (Chrome, Edge): the browser's speech recognition, words appear as you speak; no server, no AI credits.
 * 'record' (Brave, Firefox…): records the audio, then our server transcribes it (local Whisper; no AI credits either).
 */
export function useSpeechInput(value: string, onChange: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const base = useRef('');
  const finals = useRef('');
  const change = useRef(onChange);
  change.current = onChange;
  const mode: VoiceMode = typeof window === 'undefined' ? 'none' : Ctor() && !isBrave() ? 'live' : canRecord() ? 'record' : 'none';

  const startLive = () => {
    const r = new (Ctor() as RecognitionCtor)();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = true;
    finals.current = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finals.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      change.current(base.current + (finals.current + interim).replace(/\s+/g, ' ').trimStart());
    };
    r.onerror = (e) => { if (e.error !== 'aborted') setError(ERRORS[e.error] ?? `Voice typing stopped (${e.error}).`); };
    r.onend = () => { setListening(false); rec.current = null; };
    rec.current = r;
    r.start();
    setListening(true);
  };

  const startRecord = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());   // release the mic (the browser's recording dot goes away)
      if (timer.current) clearTimeout(timer.current);
      setListening(false);
      recorder.current = null;
      const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
      if (blob.size < 1000) { setError(ERRORS['no-speech']); return; }
      setTranscribing(true);
      try {
        const fd = new FormData();
        fd.append('file', blob, `voice.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`);
        fd.append('language', navigator.language || 'en');
        const { text } = await api.form<{ text: string }>('/voice/transcribe', fd);
        if (text) change.current(base.current + text);
        else setError(ERRORS['no-speech']);
      } catch (e) {
        setError((e as Error).message || 'Could not turn the recording into text.');
      } finally {
        setTranscribing(false);
      }
    };
    recorder.current = mr;
    mr.start();
    setListening(true);
    timer.current = setTimeout(() => mr.state === 'recording' && mr.stop(), MAX_RECORD_MS);   // safety cap
  };

  const start = useCallback(async () => {
    if (mode === 'none') { setError('Voice typing isn’t available in this browser.'); return; }
    setError(null);
    base.current = value.trim() ? `${value.trimEnd()} ` : '';
    try {
      if (mode === 'live') startLive();
      else await startRecord();
    } catch (e) {
      setListening(false);
      setError(ERRORS[(e as Error).name] ?? `Couldn’t start the microphone (${(e as Error).message}).`);
    }
  }, [value, mode]);  // eslint-disable-line react-hooks/exhaustive-deps

  const stop = useCallback(() => {
    rec.current?.stop();
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  useEffect(() => () => {   // leaving the page stops the mic
    rec.current?.abort();
    if (recorder.current?.state === 'recording') recorder.current.stop();
  }, []);

  return { mode, supported: mode !== 'none', listening, transcribing, error, start, stop, toggle: listening ? stop : start, clearError: () => setError(null) };
}
