"""Branded emails: a plain-text version (always) and an HTML version built from tables + inline CSS so it renders the same in
Gmail, Outlook and phone mail apps. No images or external files (many mail apps block them), the logo mark is pure HTML.
"""
from __future__ import annotations

from html import escape

BRAND = "Dashtor"
ACCENT = "#10b981"      # the app's green
DANGER = "#dc2626"
INK, MUTED, LINE, PAGE = "#0f1f18", "#5b6b63", "#e4ebe7", "#f3f6f4"

# purpose -> (subject, heading, intro, safety note, red?)
PURPOSES = {
    "verification": ("Your Dashtor verification code", "Verify your email",
                     "Use this code to verify your email address and finish setting up your account.",
                     "If you didn't create a Dashtor account, you can safely ignore this email.", False),
    "change": ("Confirm your Dashtor account change", "Confirm the change",
               "Use this code to confirm the change to your email address or mobile number.",
               "If you didn't ask for this, ignore this email and your details stay as they are. Consider changing your password.", False),
    "password reset": ("Your Dashtor password reset code", "Reset your password",
                       "Use this code to choose a new password for your Dashtor account.",
                       "If you didn't ask to reset your password, ignore this email: your password stays exactly as it is.", False),
    "account deletion": ("Confirm deleting your Dashtor account", "Confirm account deletion",
                         "You asked to permanently delete your Dashtor account and all of its data. Enter this code to confirm.",
                         "If this wasn't you, ignore this email: nothing will be deleted. Consider changing your password.", True),
}


def _frame(heading: str, body_html: str, accent: str) -> str:
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(heading)}</title></head>
<body style="margin:0;padding:0;background:{PAGE};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:{PAGE};padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid {LINE};border-radius:14px;overflow:hidden;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<tr><td style="height:5px;background:{accent};line-height:5px;font-size:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 32px 8px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:40px;height:40px;background:{accent};border-radius:10px;text-align:center;vertical-align:middle;color:#ffffff;font-size:22px;font-weight:800;line-height:40px;">D</td>
<td style="padding-left:12px;font-size:22px;font-weight:700;color:{INK};letter-spacing:-0.3px;">{BRAND}</td>
</tr></table></td></tr>
<tr><td style="padding:12px 32px 4px 32px;"><h1 style="margin:0;font-size:22px;line-height:1.3;color:{INK};">{escape(heading)}</h1></td></tr>
{body_html}
<tr><td style="padding:0 32px;"><div style="border-top:1px solid {LINE};"></div></td></tr>
<tr><td style="padding:18px 32px 28px 32px;font-size:12px;line-height:1.6;color:{MUTED};">
Sent by {BRAND}. This is an automated message, so replies aren't monitored.<br>You received it because this address was used on {BRAND}.
</td></tr>
</table></td></tr></table></body></html>"""


def code_email(purpose: str, code: str, minutes: int) -> tuple[str, str, str]:
    """(subject, plain text, html) for a one-time code."""
    subject, heading, intro, note, red = PURPOSES.get(purpose, PURPOSES["verification"])
    accent = DANGER if red else ACCENT
    text = f"{heading}\n\n{intro}\n\nYour code: {code}\nIt expires in {minutes} minutes.\n\n{note}\n\n{BRAND}"
    body = f"""<tr><td style="padding:6px 32px 0 32px;font-size:15px;line-height:1.6;color:{MUTED};">{escape(intro)}</td></tr>
<tr><td align="center" style="padding:22px 32px 6px 32px;">
<div style="display:inline-block;background:{PAGE};border:1px solid {LINE};border-radius:12px;padding:16px 28px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:{accent};">{escape(code)}</div>
</td></tr>
<tr><td align="center" style="padding:4px 32px 22px 32px;font-size:13px;color:{MUTED};">This code expires in <b>{minutes} minutes</b>.</td></tr>
<tr><td style="padding:0 32px 20px 32px;"><div style="background:{PAGE};border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;color:{MUTED};">{escape(note)}</div></td></tr>"""
    return subject, text, _frame(heading, body, accent)


def notice_email(title: str, message: str) -> tuple[str, str, str]:
    """(subject, plain text, html) for a heads-up with no code, e.g. 'your number was changed'."""
    text = f"{title}\n\n{message}\n\n{BRAND}"
    body = f"""<tr><td style="padding:6px 32px 22px 32px;font-size:15px;line-height:1.6;color:{MUTED};">{escape(message)}</td></tr>"""
    return f"{BRAND}: {title}", text, _frame(title, body, ACCENT)


def link_email(heading: str, intro: str, button: str, url: str, note: str, valid_hours: int) -> tuple[str, str, str]:
    """(subject, plain text, html) for an email whose job is one big button, e.g. 'Confirm your email'."""
    text = f"{heading}\n\n{intro}\n\n{button}: {url}\n\nThis link works for {valid_hours} hours.\n\n{note}\n\n{BRAND}"
    safe = escape(url, quote=True)
    body = f"""<tr><td style="padding:6px 32px 0 32px;font-size:15px;line-height:1.6;color:{MUTED};">{escape(intro)}</td></tr>
<tr><td align="center" style="padding:26px 32px 8px 32px;">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:{ACCENT};border-radius:10px;">
<a href="{safe}" style="display:inline-block;padding:14px 30px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">{escape(button)}</a>
</td></tr></table></td></tr>
<tr><td align="center" style="padding:6px 32px 20px 32px;font-size:13px;color:{MUTED};">This link works for <b>{valid_hours} hours</b>.</td></tr>
<tr><td style="padding:0 32px 8px 32px;font-size:12px;line-height:1.6;color:{MUTED};">If the button doesn't work, copy this address into your browser:<br>
<a href="{safe}" style="color:{ACCENT};word-break:break-all;">{escape(url)}</a></td></tr>
<tr><td style="padding:12px 32px 20px 32px;"><div style="background:{PAGE};border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.6;color:{MUTED};">{escape(note)}</div></td></tr>"""
    return f"{BRAND}: {heading}", text, _frame(heading, body, ACCENT)
