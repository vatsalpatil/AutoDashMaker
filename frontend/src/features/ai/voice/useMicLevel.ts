import { useCallback, useRef, useState } from 'react';

const SPEECH_RMS = 0.02;   // above this the mic is hearing a voice, not room noise

/**
 * Live input level of a mic stream (0..1, for the meter) and when speech was last heard (for the silence auto-stop).
 * `attach(stream)` starts measuring, `detach()` stops and frees the audio context.
 */
export function useMicLevel() {
  const [level, setLevel] = useState(0);
  const lastVoice = useRef(Date.now());
  const ctx = useRef<AudioContext | null>(null);
  const raf = useRef(0);

  const detach = useCallback(() => {
    cancelAnimationFrame(raf.current);
    void ctx.current?.close();
    ctx.current = null;
    setLevel(0);
  }, []);

  const attach = useCallback((stream: MediaStream) => {
    detach();
    lastVoice.current = Date.now();
    const ac = new AudioContext();
    const an = ac.createAnalyser();
    an.fftSize = 512;
    ac.createMediaStreamSource(stream).connect(an);
    ctx.current = ac;
    const buf = new Float32Array(an.fftSize);
    let frame = 0;
    const tick = () => {
      an.getFloatTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += v * v;
      const rms = Math.sqrt(sum / buf.length);
      if (rms > SPEECH_RMS) lastVoice.current = Date.now();
      if (++frame % 3 === 0) setLevel(Math.min(1, rms * 8));   // ~20 updates a second is plenty for a meter
      raf.current = requestAnimationFrame(tick);
    };
    tick();
  }, [detach]);

  /** Milliseconds since speech was last heard. */
  const silentFor = useCallback(() => Date.now() - lastVoice.current, []);
  const heard = useCallback(() => { lastVoice.current = Date.now(); }, []);
  return { level, attach, detach, silentFor, heard };
}
