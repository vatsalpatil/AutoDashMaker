"""Speech-to-text for voice typing in browsers without built-in speech recognition (Brave, Firefox).

Runs Whisper locally with faster-whisper (CPU, int8): free, private (audio never leaves the server), no API key.
The model downloads once on first use into data/models and is then shared by all requests.
"""
from __future__ import annotations

import io
import threading

from ..core.config import DATA_DIR, settings

_model = None
_lock = threading.Lock()


def _get_model():
    global _model
    with _lock:   # first callers wait for one load instead of loading the model several times
        if _model is None:
            from faster_whisper import WhisperModel   # heavy import: only when voice typing is first used
            _model = WhisperModel(settings.whisper_model, device="cpu", compute_type="int8",
                                  download_root=str(DATA_DIR / "models"))
        return _model


def _decode(audio: bytes):
    """Recording -> 16 kHz mono float32 samples. Done here (not by faster-whisper) because its own decoder
    calls an av.open() argument that newer PyAV versions removed."""
    import av
    import numpy as np
    chunks = []
    with av.open(io.BytesIO(audio), mode="r") as container:
        resampler = av.AudioResampler(format="s16", layout="mono", rate=16000)
        try:
            for frame in container.decode(audio=0):
                for out in resampler.resample(frame):
                    chunks.append(out.to_ndarray().reshape(-1))
        except av.error.FFmpegError:
            if not chunks:   # unreadable from the start: not audio
                raise
            # a recording sent while still in progress can end mid-chunk: keep everything decoded up to there
        for out in resampler.resample(None):   # flush
            chunks.append(out.to_ndarray().reshape(-1))
    if not chunks:
        raise ValueError("no audio in the recording")
    return np.concatenate(chunks).astype(np.float32) / 32768.0


def transcribe(audio: bytes, language: str | None = None) -> str:
    """Text of a short recording (webm/ogg/mp4/wav: anything ffmpeg reads). `language` like 'en' or 'en-US'."""
    lang = (language or "").split("-")[0].lower() or None
    segments, _ = _get_model().transcribe(_decode(audio), language=lang, beam_size=1, vad_filter=True,
                                          condition_on_previous_text=False)
    return " ".join(s.text.strip() for s in segments).strip()
