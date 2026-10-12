"""Plain-language versions of the errors an AI provider returns (rate limits, bad key, no credits), for the UI."""
from __future__ import annotations


def is_daily_limit(message: str) -> bool:
    """A per-day quota will not clear by waiting a few seconds, so callers must not retry it."""
    m = message.lower()
    return "per-day" in m or "per day" in m or "daily" in m


def friendly(error: object) -> str:
    from .ai_limits import LimitReached
    if isinstance(error, LimitReached):   # already plain language, with the time it works again
        return str(error)
    msg = str(error)
    if "works again in" in msg:
        return msg
    low = msg.lower()
    if is_daily_limit(msg):
        return ("Your AI provider's daily limit for free models is used up (OpenRouter allows about 50 free-model requests per day per account, "
                "shared by everything that uses your key). It resets at midnight UTC. Add credits at openrouter.ai to unlock more, or pick "
                "another model or provider in Settings → AI models.")
    if "429" in msg or "rate-limit" in low or "rate limit" in low or "rate-limited" in low:
        return "The AI provider is rate-limiting requests right now. Wait a minute and try again, or pick another model in Settings → AI models."
    if msg[:3] in ("401", "403") or "invalid api key" in low or "incorrect api key" in low or "no auth" in low:
        return "The AI provider rejected the API key. Check or replace it in Settings → AI models."
    if msg[:3] == "402" or "insufficient credit" in low or "out of credits" in low:
        return "The AI provider says the account is out of credits. Add credits there, or pick another model or provider in Settings → AI models."
    return msg
