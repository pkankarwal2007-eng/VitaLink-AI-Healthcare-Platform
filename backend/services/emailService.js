const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');

// In-memory test store: strictly available ONLY in test environment
let _lastTestDispatchedOtp = null;

/**
 * Get or create the Nodemailer transport instance
 */
const getTransporter = () => {
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const port = parseInt(process.env.EMAIL_PORT, 10) || 465;
  const user = (process.env.EMAIL_USER || 'kankarwal2007@gmail.com').trim();
  const rawPass = process.env.EMAIL_PASSWORD;

  if (!rawPass || typeof rawPass !== 'string' || !rawPass.trim()) {
    return null;
  }

  // Support Gmail App Passwords (strip spaces if user copy-pasted as 'xxxx xxxx xxxx xxxx')
  let pass = rawPass.trim();
  if ((pass.startsWith('"') && pass.endsWith('"')) || (pass.startsWith("'") && pass.endsWith("'"))) {
    pass = pass.slice(1, -1).trim();
  }
  pass = pass.replace(/\s+/g, '');

  if (host.toLowerCase().includes('gmail') || user.toLowerCase().includes('gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass
      }
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass
    }
  });
};

/**
 * Verify SMTP connection safely without exposing credentials
 * @returns {Promise<{ configured: boolean, connected: boolean, message: string, code?: string }>}
 */
const verifyConnection = async () => {
  const rawPass = process.env.EMAIL_PASSWORD;
  if (!rawPass || !rawPass.trim()) {
    return {
      configured: false,
      connected: false,
      message: 'EMAIL_PASSWORD is not configured in root .env'
    };
  }

  const transporter = getTransporter();
  if (!transporter) {
    return {
      configured: false,
      connected: false,
      message: 'Failed to initialize Nodemailer transport'
    };
  }

  try {
    await transporter.verify();
    return {
      configured: true,
      connected: true,
      message: 'SMTP connection verified successfully with Gmail'
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      message: error.message || 'SMTP connection failed',
      code: error.code || 'SMTP_ERROR'
    };
  }
};

/**
 * Locate the VitaLink logo file for CID inline attachment
 */
const getLogoAttachment = () => {
  const possiblePaths = [
    path.join(__dirname, '..', '..', 'frontend', 'public', 'logo.png'),
    path.join(__dirname, '..', 'uploads', 'logo.png')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return [
        {
          filename: 'logo.png',
          path: p,
          cid: 'vitalink-logo'
        }
      ];
    }
  }

  return [];
};

/**
 * Build professional VitaLink-branded HTML email template
 */
const buildVerificationEmailHtml = ({ fullName, otp, expiresMinutes }) => {
  const safeName = fullName ? fullName.trim() : 'VitaLink User';
  const expiry = expiresMinutes || 10;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VitaLink Email Verification</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f172a 0%, #0369a1 100%); padding: 36px 24px; text-align: center;">
              <table border="0" cellpadding="0" cellspacing="0" align="center">
                <tr>
                  <td align="center">
                    <img src="cid:vitalink-logo" alt="VitaLink" width="60" height="60" style="display: block; margin: 0 auto 12px auto; border-radius: 12px;" />
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -0.5px;">VitaLink</h1>
                    <p style="color: #bae6fd; margin: 4px 0 0 0; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px;">Smarter Healthcare. Connected.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px; color: #334155;">
              <h2 style="color: #0f172a; font-size: 20px; font-weight: 700; margin: 0 0 16px 0; text-align: center;">Verify Your Email Address</h2>
              
              <p style="font-size: 15px; line-height: 24px; margin: 0 0 16px 0; color: #475569;">
                Hello <strong>${safeName}</strong>,
              </p>
              
              <p style="font-size: 15px; line-height: 24px; margin: 0 0 24px 0; color: #475569;">
                Thank you for creating your VitaLink account. To complete your registration and secure your medical profile, please enter the 6-digit verification code below:
              </p>

              <!-- OTP Highlight Box -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="background-color: #f0f9ff; border: 2px dashed #0284c7; border-radius: 12px; padding: 24px 16px;">
                    <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 12px; color: #0284c7; padding-left: 12px;">
                      ${otp}
                    </div>
                    <p style="margin: 10px 0 0 0; font-size: 13px; font-weight: 600; color: #0369a1;">
                      Code expires in ${expiry} minutes
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security Notices -->
              <p style="font-size: 13px; line-height: 20px; color: #64748b; margin: 0 0 14px 0;">
                <strong>Security Notice:</strong> This code is strictly confidential. Never share your verification code with anyone. VitaLink representatives will never ask for your verification code or password.
              </p>

              <p style="font-size: 13px; line-height: 20px; color: #94a3b8; margin: 0 0 10px 0;">
                If you did not create a VitaLink account, you can safely ignore this email. No action is required and the account will remain inactive.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 24px; text-align: center; color: #94a3b8; font-size: 12px; line-height: 18px;">
              <p style="margin: 0; font-weight: 600; color: #64748b;">VitaLink Healthcare Platform</p>
              <p style="margin: 4px 0 0 0;">Secure Automated Communication &bull; Please do not reply to this email</p>
              <p style="margin: 8px 0 0 0; font-size: 11px; color: #cbd5e1;">&copy; ${new Date().getFullYear()} VitaLink. All rights reserved.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};

/**
 * Send 6-digit email verification OTP to the user.
 * @param {Object} options
 * @param {string} options.email Destination email address
 * @param {string} options.fullName Recipient's full name
 * @param {string} options.otp 6-digit verification code
 * @param {number} [options.expiresMinutes=10] Expiration in minutes
 * @returns {Promise<{ delivered: boolean, mode: string, error?: string, messageId?: string }>}
 */
const sendEmailVerificationOtp = async ({ email, fullName, otp, expiresMinutes = 10 }) => {
  if (!email || !otp) {
    throw new Error('Destination email and OTP are required for email dispatch.');
  }

  // Record OTP in test mode for automated test assertion
  if (process.env.NODE_ENV === 'test') {
    _lastTestDispatchedOtp = otp;
    return {
      delivered: true,
      mode: 'test_mock',
      messageId: `test-${Date.now()}`
    };
  }

  const senderUser = (process.env.EMAIL_USER || 'kankarwal2007@gmail.com').trim();
  const senderFrom = (process.env.EMAIL_FROM || `VitaLink <${senderUser}>`).trim();

  const html = buildVerificationEmailHtml({ fullName, otp, expiresMinutes });
  const attachments = getLogoAttachment();

  const transporter = getTransporter();

  if (!transporter) {
    const errorMsg = 'SMTP credentials not configured: EMAIL_PASSWORD is not set in root .env';
    console.error(`[VitaLink Email Service] Delivery failed: ${errorMsg}`);
    return {
      delivered: false,
      mode: 'unconfigured',
      error: errorMsg
    };
  }

  try {
    const info = await transporter.sendMail({
      from: senderFrom,
      to: email,
      subject: 'VitaLink - Verify your email address',
      html,
      attachments
    });

    console.log(`[VitaLink Email Service] Verification email dispatched successfully to ${email} (Message ID: ${info.messageId})`);
    return {
      delivered: true,
      mode: 'smtp_live',
      messageId: info.messageId
    };
  } catch (error) {
    console.error(`[VitaLink Email Service Error] Failed to send email to ${email}:`, error.message);
    return {
      delivered: false,
      mode: 'smtp_error',
      error: error.message
    };
  }
};

/**
 * Test helper: Retrieve the last test dispatched OTP (strictly for automated test assertions).
 * Never exposed outside test environment.
 */
const __getLastTestDispatchedOtp = () => {
  if (process.env.NODE_ENV !== 'test') return null;
  return _lastTestDispatchedOtp;
};

module.exports = {
  sendEmailVerificationOtp,
  verifyConnection,
  buildVerificationEmailHtml,
  __getLastTestDispatchedOtp
};
