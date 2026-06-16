"""Outbound SMTP helper.

Configured entirely from env. If `REACH_SMTP_HOST` is unset the helper is in
"dry-run" mode: every call logs the message and returns `(False, "smtp_not_configured")`
instead of attempting a network send. This keeps the dashboard usable in
environments without outbound mail while letting production light up email
features by adding a few env vars.
"""
from __future__ import annotations

import os
import smtplib
import ssl
from email.message import EmailMessage
from email.utils import formataddr
from typing import Iterable


def _truthy(v: str | None) -> bool:
    return (v or "").strip().lower() in {"1", "true", "yes", "on"}


SMTP_HOST = os.environ.get("REACH_SMTP_HOST", "").strip()
SMTP_PORT = int(os.environ.get("REACH_SMTP_PORT", "587") or 587)
SMTP_USER = os.environ.get("REACH_SMTP_USER", "").strip()
SMTP_PASS = os.environ.get("REACH_SMTP_PASS", "")
SMTP_FROM = os.environ.get("REACH_SMTP_FROM", "").strip() or SMTP_USER
SMTP_FROM_NAME = os.environ.get("REACH_SMTP_FROM_NAME", "REACH Dashboard").strip()
# Connection mode: 'starttls' | 'ssl' | 'plain'.  Default starttls (port 587).
SMTP_MODE = os.environ.get("REACH_SMTP_MODE", "starttls").strip().lower()
SMTP_TIMEOUT = int(os.environ.get("REACH_SMTP_TIMEOUT", "10") or 10)


def is_configured() -> bool:
    """True when at least HOST + FROM are set. USER/PASS are optional for
    relays that accept submission from trusted networks without auth."""
    return bool(SMTP_HOST and SMTP_FROM)


def send_mail(
    to: Iterable[str] | str,
    subject: str,
    body_text: str,
    body_html: str | None = None,
) -> tuple[bool, str]:
    """Send a single message to one or more recipients.

    Returns `(ok, detail)`. `ok=False` with `detail="smtp_not_configured"`
    means the call was a no-op because SMTP env isn't set — surface this to
    the UI so the user knows the schedule was saved but no mail went out.
    """
    if isinstance(to, str):
        recipients = [to.strip()] if to.strip() else []
    else:
        recipients = [r.strip() for r in to if r and r.strip()]
    if not recipients:
        return (False, "no_recipients")

    if not is_configured():
        print(f"[mail] (dry-run) would send to {recipients}: {subject!r}")
        return (False, "smtp_not_configured")

    msg = EmailMessage()
    msg["From"] = formataddr((SMTP_FROM_NAME, SMTP_FROM))
    msg["To"] = ", ".join(recipients)
    msg["Subject"] = subject
    msg.set_content(body_text)
    if body_html:
        msg.add_alternative(body_html, subtype="html")

    try:
        if SMTP_MODE == "ssl":
            ctx = ssl.create_default_context()
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT, context=ctx) as s:
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=SMTP_TIMEOUT) as s:
                s.ehlo()
                if SMTP_MODE == "starttls":
                    s.starttls(context=ssl.create_default_context())
                    s.ehlo()
                if SMTP_USER:
                    s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
    except smtplib.SMTPException as e:
        print(f"[mail] SMTP error to {recipients}: {e}")
        return (False, f"smtp_error: {e}")
    except OSError as e:
        # Network unreachable, DNS failure, etc.
        print(f"[mail] network error to {recipients}: {e}")
        return (False, f"network_error: {e}")
    return (True, "sent")


# ----- Convenience template helpers used by routes/insights.py --------------
def confirmation_report(emails, scopes, fmt, cadence, send_time, timezone) -> tuple[str, str]:
    """Build (subject, body) for the "you have been subscribed" confirmation."""
    scope_str = ", ".join(scopes or ["REGIONAL"])
    subject = f"REACH Dashboard — report subscription confirmed ({scope_str})"
    body = (
        "Hello,\n\n"
        "You (or a colleague) just scheduled an automated REACH Regional "
        "Dashboard report:\n\n"
        f"  Scope    : {scope_str}\n"
        f"  Format   : {(fmt or 'pdf').upper()}\n"
        f"  Cadence  : {cadence or 'weekly'}\n"
        f"  Time     : {send_time or '08:00'} ({timezone or 'Africa/Lagos'})\n"
        f"  Sent to  : {', '.join(emails)}\n\n"
        "You will receive the first report at the next scheduled run. "
        "To stop these emails, sign in and remove the subscription from the "
        "Notifications drawer.\n\n"
        "— REACH Dashboard\n"
    )
    return subject, body


def confirmation_alert(email, metric, comparison, threshold, scope) -> tuple[str, str]:
    op = "<" if comparison == "lt" else (">" if comparison == "gt" else "=")
    subject = f"REACH Dashboard — alert armed ({scope or 'REGIONAL'} · {metric})"
    body = (
        "Hello,\n\n"
        "An alert has been armed on the REACH Dashboard:\n\n"
        f"  Scope     : {scope or 'REGIONAL'}\n"
        f"  Metric    : {metric}\n"
        f"  Condition : {metric} {op} {threshold}\n"
        f"  Notify    : {email}\n\n"
        "You will be notified when the condition is met. Sign in and remove "
        "the alert from the Notifications drawer at any time.\n\n"
        "— REACH Dashboard\n"
    )
    return subject, body


def confirmation_feedback(kind, subject, message, page, username) -> tuple[str, str]:
    s = f"REACH Dashboard — feedback received ({kind})"
    body = (
        "Hello,\n\n"
        "Thank you — your feedback has been received and the team will "
        "review it shortly.\n\n"
        f"  Type    : {kind}\n"
        f"  Subject : {subject}\n"
        f"  Page    : {page or '(not provided)'}\n"
        f"  From    : {username or '(anonymous)'}\n\n"
        "Your message:\n"
        "----------------------------------------\n"
        f"{message}\n"
        "----------------------------------------\n\n"
        "— REACH Dashboard\n"
    )
    return s, body
