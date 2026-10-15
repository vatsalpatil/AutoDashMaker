import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useMicLevel } from './useMicLevel';

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

const SILENCE_STOP_MS = 30_000;   // nobody spoke for 30 s: stop and keep what was said
const MAX_MS = 5 * 60_000;        // hard cap on one recording
const PARTIAL_EVERY_MS = 2_500;   // record mode: re-transcribe the audio so far this often, so words appear while speaking

const BLOCKED = 'Microphone access is blocked. Allow the microphone for this site in the address bar, then try again.';
const ERRORS: Record<string, string> = {
  'not-allowed': BLOCKED, 'service-not-allowed': BLOCKED, NotAllowedError: BLOCKED,
  NotFoundError: 'No microphone found.', 'audio-capture': 'No microphone found.',
  'no-speech': 'Didn’t hear anything. Click the mic and speak.',
  network: 'Voice typing could not reach the speech service. Try again.',
};

export type VoiceMode = 'live' | 'record' | 'none';

/**
 * Voice typing into a text box, appended after what was already typed. Words show while you speak; it keeps listening
 * through pauses and stops on its own after 30 s without speech (or when you click stop), keeping everything said.
 * 'live' (Chrome, Edge): the browser's speech recognition. 'record' (Brave, Firefox): the recording so far is
 * re-transcribed by our server every few seconds (local Whisper), then once more in full when you stop. No AI credits.
 */
export function useSpeechInput(value: string, onChange: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const mic = useMicLevel();
  const change = useRef(onChange);
  change.current = onChange;
  const s = useRef({ base: '', said: '', userStop: true, started: 0, stream: null as MediaStream | null,
    rec: null as Recognition | null, mr: null as MediaRecorder | null, chunks: [] as Blob[], inflight: false, ticker: 0 });
  const mode: VoiceMode = typeof window === 'undefined' ? 'none' : Ctor() && !isBrave() ? 'live' : canRecord() ? 'record' : 'none';

  const show = (spoken: string) => { s.current.said = spoken; change.current(s.current.base + spoken.replace(/\s+/g, ' ').trim()); };

  const transcribe = async (final: boolean) => {
    const st = s.current;
    if (!st.chunks.length || (st.inflight && !final)) return;
    const blob = new Blob(st.chunks, { type: st.mr?.mimeType || 'audio/webm' });
    if (blob.size < 1000) return;
    st.inflight = true;
    try {
      const fd = new FormData();
      fd.append('file', blob, `voice.${blob.type.includes('mp4') ? 'mp4' : blob.type.includes('ogg') ? 'ogg' : 'webm'}`);
      fd.append('language', navigator.language || 'en');
      const { text } = await api.form<{ text: string }>('/voice/transcribe', fd);
      if (text) show(text);
      else if (final && !st.said) setError(ERRORS['no-speech']);
    } catch (e) {
      if (final) setError((e as Error).message || 'Could not turn the recording into text.');
    } finally {
      st.inflight = false;
    }
  };

  const finish = () => {   // tear down everything the recording used
    const st = s.current;
    window.clearInterval(st.ticker);
    st.stream?.getTracks().forEach((t) => t.stop());   // release the mic (the browser's recording dot goes away)
    st.stream = null;
    mic.detach();
    setListening(false);
  };

  const startLive = () => {
    const st = s.current;
    const r = new (Ctor() as RecognitionCtor)();
    r.lang = navigator.language || 'en-US';
    r.continuous = true;
    r.interimResults = true;
    let finals = '';
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finals += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      mic.heard();
      show(finals + interim);
    };
    r.onerror = (e) => { if (!['aborted', 'no-speech'].includes(e.error)) { st.userStop = true; setError(ERRORS[e.error] ?? `Voice typing stopped (${e.error}).`); } };
    r.onend = () => {
      st.rec = null;
      // the browser ends recognition on short pauses: carry on until the user stops or 30 s pass in silence
      if (!st.userStop) { st.base = `${st.base}${st.said.trim()}${st.said.trim() ? ' ' : ''}`; st.said = ''; startLive(); }
      else finish();
    };
    st.rec = r;
    r.start();
  };

  const startRecord = (stream: MediaStream) => {
    const st = s.current;
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported?.(t));
    const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    st.chunks = [];
    mr.ondataavailable = (e) => { if (e.data.size) st.chunks.push(e.data); };
    mr.onstop = async () => {
      finish();
      setTranscribing(true);
      while (st.inflight) await new Promise((r) => setTimeout(r, 100));   // let a partial finish, then do the full pass
      await transcribe(true);
      setTranscribing(false);
      st.mr = null;
    };
    st.mr = mr;
    mr.start(1000);   // a chunk every second: the audio so far is always available for a partial transcript
  };

  const stop = useCallback(() => {
    const st = s.current;
    st.userStop = true;
    st.rec?.stop();
    if (st.mr?.state === 'recording') st.mr.stop();
  }, []);

  const start = useCallback(async () => {
    if (mode === 'none') { setError('Voice typing isn’t available in this browser.'); return; }
    const st = s.current;
    setError(null);
    st.base = value.trim() ? `${value.trimEnd()} ` : '';
    st.said = '';
    st.userStop = false;
    try {
      st.stream = await navigator.mediaDevices.getUserMedia({ audio: true });   // also feeds the level meter in live mode
      mic.attach(st.stream);
      if (mode === 'live') startLive();
      else startRecord(st.stream);
    } catch (e) {
      finish();
      setError(ERRORS[(e as Error).name] ?? `Couldn’t start the microphone (${(e as Error).message}).`);
      return;
    }
    st.started = Date.now();
    setElapsed(0);
    setListening(true);
    let lastPartial = Date.now();
    st.ticker = window.setInterval(() => {
      setElapsed(Date.now() - st.started);
      if (mic.silentFor() > SILENCE_STOP_MS || Date.now() - st.started > MAX_MS) { stop(); return; }
      if (mode === 'record' && Date.now() - lastPartial > PARTIAL_EVERY_MS) { lastPartial = Date.now(); void transcribe(false); }
    }, 250);
  }, [value, mode]);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {   // leaving the page stops the mic
    const st = s.current;
    st.userStop = true;
    st.rec?.abort();
    if (st.mr?.state === 'recording') st.mr.stop();
    finish();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return { mode, supported: mode !== 'none', listening, transcribing, elapsed, level: mic.level, error,
    start, stop, toggle: listening ? stop : start, clearError: () => setError(null) };
}
