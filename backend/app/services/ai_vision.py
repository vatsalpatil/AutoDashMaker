"""Images in AI chats: the user's pictures (screenshots of dashboards, charts, tables, sketches) travel with every model call of
that request. An endpoint calls `use(body.images)`; `ai._call` then attaches them to the last user message in the provider's
format (OpenAI-style parts here; the Anthropic and Gemini adapters convert them with `anthropic_parts` / `gemini_parts`)."""
from __future__ import annotations

import re
from contextvars import ContextVar
from typing import Any

MAX_IMAGES = 4
MAX_CHARS = 7_000_000   # ~5 MB of image per data URL (the browser downsizes to ~1600 px first)
_DATA_URL = re.compile(r"^data:(image/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$")

images: ContextVar[tuple[str, ...]] = ContextVar("ai_images", default=())

VISION_HINT = ("Images are attached: read them carefully (they may show a dashboard to imitate, a chart, a table, a sketch or an error) and use "
               "what they show together with the text.")


def use(urls: list[str] | None) -> None:
    """Keep the valid image data URLs of this request (at most MAX_IMAGES); raises ValueError for a bad one."""
    ok = []
    for u in (urls or [])[:MAX_IMAGES]:
        if not isinstance(u, str) or len(u) > MAX_CHARS or not _DATA_URL.match(u):
            raise ValueError("Attach PNG, JPEG, WebP or GIF images up to about 5 MB each.")
        ok.append(u)
    images.set(tuple(ok))


def apply(messages: list[dict]) -> list[dict]:
    """The messages with this request's images added to the last user message (OpenAI content-parts format)."""
    imgs = images.get()
    if not imgs:
        return messages
    out = [dict(m) for m in messages]
    for m in reversed(out):
        if m.get("role") == "user" and isinstance(m.get("content"), str):
            m["content"] = [{"type": "text", "text": f"{m['content']}\n\n{VISION_HINT}"},
                            *({"type": "image_url", "image_url": {"url": u}} for u in imgs)]
            break
    return out


def _split(url: str) -> tuple[str, str]:
    m = _DATA_URL.match(url)
    mime = m.group(1).replace("image/jpg", "image/jpeg") if m else "image/png"
    return mime, (m.group(2) if m else "")


def anthropic_parts(content: Any) -> Any:
    if not isinstance(content, list):
        return content
    parts = []
    for p in content:
        if p.get("type") == "image_url":
            mime, data = _split(p["image_url"]["url"])
            parts.append({"type": "image", "source": {"type": "base64", "media_type": mime, "data": data}})
        else:
            parts.append({"type": "text", "text": p.get("text", "")})
    return parts


def gemini_parts(content: Any) -> list[dict]:
    if not isinstance(content, list):
        return [{"text": content}]
    parts = []
    for p in content:
        if p.get("type") == "image_url":
            mime, data = _split(p["image_url"]["url"])
            parts.append({"inline_data": {"mime_type": mime, "data": data}})
        else:
            parts.append({"text": p.get("text", "")})
    return parts


def text_of(content: Any) -> str:
    """Plain text of a message (for token estimates and logs): image parts count as a marker."""
    if isinstance(content, list):
        return " ".join(p.get("text", "") if p.get("type") == "text" else "[image]" for p in content)
    return str(content)


def is_vision_error(message: str) -> bool:
    m = message.lower()
    return "image" in m and any(k in m for k in ("support", "modalit", "vision", "multimodal", "not allowed", "invalid content"))
