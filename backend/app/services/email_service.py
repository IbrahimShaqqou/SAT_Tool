"""
ZooPrep - Email Service

Handles sending transactional emails using SendGrid.
"""

import logging
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)


def send_email(
    to_email: str,
    subject: str,
    html_content: str,
    plain_content: Optional[str] = None,
) -> bool:
    """
    Send an email using SendGrid.

    Args:
        to_email: Recipient email address
        subject: Email subject line
        html_content: HTML body of the email
        plain_content: Plain text fallback (optional)

    Returns:
        True if email was sent successfully, False otherwise
    """
    if not settings.sendgrid_api_key:
        logger.warning("SendGrid API key not configured. Email not sent.")
        return False

    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail, Email, To, Content

        message = Mail(
            from_email=Email(settings.from_email, settings.from_name),
            to_emails=To(to_email),
            subject=subject,
            html_content=Content("text/html", html_content),
        )

        if plain_content:
            message.add_content(Content("text/plain", plain_content))

        sg = SendGridAPIClient(settings.sendgrid_api_key)
        response = sg.send(message)

        if response.status_code >= 200 and response.status_code < 300:
            logger.info(f"Email sent successfully to {to_email}")
            return True
        else:
            logger.error(f"Failed to send email: {response.status_code}")
            return False

    except ImportError:
        logger.error("SendGrid package not installed. Run: pip install sendgrid")
        return False
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {str(e)}")
        return False


def send_password_reset_email(to_email: str, reset_url: str, user_name: str = "there") -> bool:
    """
    Send a password reset email.

    Args:
        to_email: User's email address
        reset_url: The password reset URL with token
        user_name: User's first name for personalization

    Returns:
        True if email was sent successfully
    """
    subject = "Reset your ZooPrep password"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #111; font-size: 24px; margin: 0;">ZooPrep</h1>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="color: #111; font-size: 20px; margin: 0 0 15px 0;">Reset your password</h2>
            <p style="margin: 0 0 20px 0;">Hi {user_name},</p>
            <p style="margin: 0 0 20px 0;">We received a request to reset your password. Click the button below to create a new password:</p>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" style="background: #111; color: #fff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">Reset Password</a>
            </div>

            <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;">This link will expire in 1 hour for security reasons.</p>
            <p style="margin: 0; font-size: 14px; color: #666;">If you didn't request this, you can safely ignore this email.</p>
        </div>

        <div style="text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0;">ZooPrep - SAT Preparation Platform</p>
            <p style="margin: 5px 0 0 0;">This is an automated message, please do not reply.</p>
        </div>
    </body>
    </html>
    """

    plain_content = f"""
    Reset your ZooPrep password

    Hi {user_name},

    We received a request to reset your password. Visit the link below to create a new password:

    {reset_url}

    This link will expire in 1 hour for security reasons.

    If you didn't request this, you can safely ignore this email.

    ---
    ZooPrep - SAT Preparation Platform
    """

    return send_email(to_email, subject, html_content, plain_content)


def send_welcome_email(to_email: str, user_name: str) -> bool:
    """
    Send a welcome email to new users.

    Args:
        to_email: User's email address
        user_name: User's first name

    Returns:
        True if email was sent successfully
    """
    subject = "Welcome to ZooPrep!"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #111; font-size: 24px; margin: 0;">ZooPrep</h1>
        </div>

        <div style="background: #f9fafb; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h2 style="color: #111; font-size: 20px; margin: 0 0 15px 0;">Welcome to ZooPrep!</h2>
            <p style="margin: 0 0 20px 0;">Hi {user_name},</p>
            <p style="margin: 0 0 20px 0;">Thanks for joining ZooPrep! We're excited to help you prepare for the SAT.</p>

            <p style="margin: 0 0 10px 0;"><strong>Here's what you can do:</strong></p>
            <ul style="margin: 0 0 20px 0; padding-left: 20px;">
                <li>Practice with our adaptive question system</li>
                <li>Track your progress across all skills</li>
                <li>Get personalized recommendations</li>
            </ul>

            <div style="text-align: center; margin: 30px 0;">
                <a href="{settings.frontend_url}/login" style="background: #111; color: #fff; padding: 12px 30px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">Get Started</a>
            </div>
        </div>

        <div style="text-align: center; font-size: 12px; color: #999;">
            <p style="margin: 0;">ZooPrep - SAT Preparation Platform</p>
        </div>
    </body>
    </html>
    """

    plain_content = f"""
    Welcome to ZooPrep!

    Hi {user_name},

    Thanks for joining ZooPrep! We're excited to help you prepare for the SAT.

    Here's what you can do:
    - Practice with our adaptive question system
    - Track your progress across all skills
    - Get personalized recommendations

    Get started: {settings.frontend_url}/login

    ---
    ZooPrep - SAT Preparation Platform
    """

    return send_email(to_email, subject, html_content, plain_content)
