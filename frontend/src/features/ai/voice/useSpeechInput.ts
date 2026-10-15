import { useCallback, useEffect, useRef, useState } from 'react';

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
const isBrave = () => !!(navigator as unknown as { brave?: unknown }).brave;

const ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access is blocked. Allow the microphone for this site in the address bar, then try again.',
  'service-not-allowed': 'Microphone access is blocked. Allow the microphone for this site in the address bar, then try again.',
  'no-speech': 'Didn’t hear anything. Click the mic and speak.',
  'audio-capture': 'No microphone found.',
  network: 'Voice typing could not reach the speech service. It works in Chrome and Edge; Brave blocks it.',
};

/**
 * Voice typing into a text box: speech becomes text live (interim words included), appended after what was already typed.
 * Uses the browser's own speech recognition: no server, no AI credits. `supported` is false in browsers without it.
 */
export function useSpeechInput(value: string, onChange: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const base = useRef('');
  const finals = useRef('');
  const change = useRef(onChange);
  change.current = onChange;
  const supported = typeof window !== 'undefined' && !!Ctor() && !isBrave();

  const stop = useCallback(() => { rec.current?.stop(); }, []);
  const start = useCallback(() => {
    const C = Ctor();
    if (!C || isBrave()) { setError(isBrave() ? ERRORS.network : 'Voice typing isn’t available in this browser. Try Chrome or Edge.'); return; }
    setError(null);
    const r = new C();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = true;
    base.current = value.trim() ? `${value.trimEnd()} ` : '';
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
    try { r.start(); setListening(true); } catch { setListening(false); }
  }, [value]);

  useEffect(() => () => rec.current?.abort(), []);   // leaving the page stops the mic
  return { supported, listening, error, start, stop, toggle: listening ? stop : start, clearError: () => setError(null) };
}
