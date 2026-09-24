const nodemailer = require('nodemailer');
const path = require('path');
// Load from project root .env (same file docker-compose env_file uses)
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

// Create reusable transporter singleton
const getTransporter = () => {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;

    return nodemailer.createTransport({
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        host: process.env.EMAIL_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.EMAIL_PORT || '587', 10),
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
            user: user || 'no-reply@kisansetu.com',
            pass: pass || 'mock-app-password'
        },
        tls: {
            rejectUnauthorized: false
        }
    });
};

/**
 * HTML Email Template for OTP Verification
 */
const getOTPTemplate = (otp, name = 'Valued User') => {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>KisanSetu Email Verification</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08); }
            .header { background: linear-gradient(135deg, #2e7d32, #1b5e20); color: #ffffff; padding: 25px 20px; text-align: center; }
            .header h1 { margin: 0; font-size: 26px; font-weight: 700; }
            .header p { margin: 5px 0 0 0; opacity: 0.9; font-size: 14px; }
            .content { padding: 30px 25px; color: #333333; line-height: 1.6; }
            .otp-container { background: #f0f8f1; border: 2px dashed #2e7d32; border-radius: 8px; padding: 20px; text-align: center; margin: 25px 0; }
            .otp-code { font-size: 36px; font-weight: 800; color: #1b5e20; letter-spacing: 8px; margin: 5px 0; }
            .expiry { font-size: 13px; color: #d32f2f; font-weight: 600; margin-top: 10px; }
            .footer { background-color: #f9f9f9; padding: 15px 20px; text-align: center; font-size: 12px; color: #777777; border-top: 1px solid #eeeeee; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🌾 KisanSetu (किसान सेतु)</h1>
                <p>Direct Farm-to-Table Ecosystem</p>
            </div>
            <div class="content">
                <h2>Email Verification Code</h2>
                <p>Namaste <strong>${name}</strong>,</p>
                <p>Thank you for registering on KisanSetu. Please use the following 6-digit One-Time Password (OTP) to verify your email address:</p>
                
                <div class="otp-container">
                    <div class="otp-code">${otp}</div>
                    <div class="expiry">⏱️ Valid for 10 minutes only</div>
                </div>

                <p>If you did not initiate this request, please ignore this email.</p>
                <p>Warm regards,<br><strong>Team KisanSetu</strong></p>
            </div>
            <div class="footer">
                &copy; ${new Date().getFullYear()} KisanSetu. All rights reserved. Connecting Farmers Directly with Consumers.
            </div>
        </div>
    </body>
    </html>
    `;
};

/**
 * Send OTP Verification Email
 * @param {string} to - Recipient email address
 * @param {string} otp - Plaintext 6-digit OTP
 * @param {string} name - User's name
 */
const sendOTPEmail = async (to, otp, name) => {
    const user = process.env.EMAIL_USER;
    const isMock = !user || user === 'your_email@gmail.com' || user === 'no-reply@kisansetu.com';

    if (isMock) {
        // --- DEV/MOCK MODE ---
        // Real email is NOT sent because EMAIL_USER is a placeholder in .env
        // To enable real emails: set EMAIL_USER and EMAIL_PASS in your root .env
        //   EMAIL_USER=your.real.gmail@gmail.com
        //   EMAIL_PASS=xxxx xxxx xxxx xxxx  (Gmail App Password, NOT your login password)
        console.log('\n╔══════════════════════════════════════════════════╗');
        console.log('║         [DEV MODE] OTP EMAIL NOT SENT            ║');
        console.log('╠══════════════════════════════════════════════════╣');
        console.log(`║  Recipient : ${to.padEnd(35)}║`);
        console.log(`║  Name      : ${(name || '').padEnd(35)}║`);
        console.log(`║  OTP CODE  : ${otp.padEnd(35)}║`);
        console.log('╚══════════════════════════════════════════════════╝\n');
        console.log('  ⚠️  Set EMAIL_USER and EMAIL_PASS in root .env to send real emails.');
        console.log('  ⚠️  Gmail requires an App Password (not your login password).');
        console.log('  ⚠️  See: https://myaccount.google.com/apppasswords\n');
        return { messageId: 'dev-mode-mock-id' };
    }

    try {
        const transporter = getTransporter();
        const mailOptions = {
            from: `"KisanSetu Support" <${process.env.EMAIL_FROM || user}>`,
            to,
            subject: `🌾 ${otp} is your KisanSetu Email Verification Code`,
            html: getOTPTemplate(otp, name)
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`[Mailer] ✅ OTP email sent to ${to} | messageId: ${info.messageId}`);
        return info;
    } catch (smtpError) {
        // Log the full error object — not just the message — so you can diagnose the root cause
        console.error('[Mailer] ❌ SMTP delivery failed!');
        console.error('[Mailer]    Error code   :', smtpError.code);
        console.error('[Mailer]    Error message:', smtpError.message);
        console.error('[Mailer]    Full error   :', JSON.stringify(smtpError, null, 2));
        console.error('[Mailer] Hint: If code=EAUTH -> wrong App Password.');
        console.error('[Mailer] Hint: If code=ECONNREFUSED/ETIMEDOUT -> firewall/Docker blocking port 587.');
        // Re-throw so the controller can roll back the user and return a real 500 error
        throw smtpError;
    }
};

module.exports = {
    sendOTPEmail
};
