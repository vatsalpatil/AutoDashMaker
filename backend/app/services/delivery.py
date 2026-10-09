"""Send a one-time code by email (SMTP) or SMS (Twilio). With no provider configured the message goes to the server log,
so the flow works end to end in development without any account, and nothing ever fails silently.
"""
from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

import httpx

from ..core.config import settings

log = logging.getLogger("dashtor.delivery")


class DeliveryError(Exception):
    """The provider rejected or could not send the message (shown to the user as a short, safe message)."""


def email_mode() -> str:
    return "smtp" if settings.smtp_host else "console"


def sms_mode() -> str:
    return "twilio" if settings.sms_provider == "twilio" and settings.twilio_account_sid else "console"


def send_email(to: str, subject: str, body: str) -> str:
    if email_mode() == "console":
        log.warning("[verify:email] to=%s subject=%r body=%r", to, subject, body)
        return "console"
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = settings.smtp_from or settings.smtp_user, to, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as s:
            s.starttls()
            if settings.smtp_user:
                s.login(settings.smtp_user, settings.smtp_password)
            s.send_message(msg)
    except (OSError, smtplib.SMTPException) as e:
        log.error("SMTP send failed: %s", e)
        raise DeliveryError("Could not send the email. Please try again in a minute.") from e
    return "smtp"


def send_sms(to: str, body: str) -> str:
    if sms_mode() == "console":
        log.warning("[verify:sms] to=%s body=%r", to, body)
        return "console"
    try:
        r = httpx.post(f"https://api.twilio.com/2010-04-01/Accounts/{settings.twilio_account_sid}/Messages.json",
                       auth=(settings.twilio_account_sid, settings.twilio_auth_token),
                       data={"To": to, "From": settings.twilio_from, "Body": body}, timeout=15)
    except httpx.HTTPError as e:
        log.error("Twilio request failed: %s", e)
        raise DeliveryError("Could not send the text message. Please try again in a minute.") from e
    if r.status_code >= 300:
        log.error("Twilio rejected the message: %s %s", r.status_code, r.text[:200])
        raise DeliveryError("The text message could not be sent to that number.")
    return "twilio"
