/**
 * KisanSetu - Standalone SMTP Email Test Script
 * Run with: node services/auth/testEmail.js
 *
 * Tests your email credentials and SMTP connectivity IN ISOLATION.
 */

const path = require('path');

// Load from root .env (same path mailer.js uses)
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const nodemailer = require('nodemailer');

// ── 1. Print env values (masks password) ──────────────────────────────────
console.log('\n==========================================');
console.log('  KisanSetu Email Config Audit');
console.log('==========================================');
console.log('EMAIL_HOST  :', process.env.EMAIL_HOST  || 'MISSING');
console.log('EMAIL_PORT  :', process.env.EMAIL_PORT  || 'MISSING');
console.log('EMAIL_SECURE:', process.env.EMAIL_SECURE || 'false (default)');
console.log('EMAIL_USER  :', process.env.EMAIL_USER  || 'MISSING');
console.log('EMAIL_PASS  :', process.env.EMAIL_PASS
    ? (process.env.EMAIL_PASS.startsWith('your_') || process.env.EMAIL_PASS === 'mock-app-password'
        ? 'PLACEHOLDER — not set!'
        : 'Set (length=' + process.env.EMAIL_PASS.length + ')')
    : 'MISSING');
console.log('==========================================\n');

// ── 2. Detect placeholder credentials ─────────────────────────────────────
const emailUser = process.env.EMAIL_USER;
const emailPass = process.env.EMAIL_PASS;

const isPlaceholder =
    !emailUser ||
    emailUser === 'your_email@gmail.com' ||
    !emailPass ||
    emailPass === 'your_app_password' ||
    emailPass === 'mock-app-password';

if (isPlaceholder) {
    console.error('[ERROR] EMAIL_USER or EMAIL_PASS are still placeholder values in your .env file!');
    console.error('');
    console.error('Fix: Open your root .env and set REAL values:');
    console.error('  EMAIL_USER=your.real.gmail@gmail.com');
    console.error('  EMAIL_PASS=xxxx xxxx xxxx xxxx  (16-char Gmail App Password)');
    console.error('');
    console.error('How to get a Gmail App Password:');
    console.error('  1. Visit https://myaccount.google.com/security');
    console.error('  2. Enable 2-Factor Authentication (REQUIRED first)');
    console.error('  3. Search "App Passwords" in your account settings');
    console.error('  4. Generate one -> copy the 16-char code into EMAIL_PASS');
    process.exit(1);
}

// ── 3. Build transporter identical to mailer.js ───────────────────────────
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT || '587', 10),
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { user: emailUser, pass: emailPass },
    tls: { rejectUnauthorized: false }
});

// ── 4. Verify SMTP connection ──────────────────────────────────────────────
async function runTest() {
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = process.env.EMAIL_PORT || 587;
    console.log('[Step 1] Verifying SMTP connection to', host, 'port', port, '...');

    try {
        await transporter.verify();
        console.log('[OK] SMTP Connection SUCCESS — credentials are valid!\n');
    } catch (verifyErr) {
        console.error('[FAIL] SMTP Connection FAILED!');
        console.error('  Error Code   :', verifyErr.code);
        console.error('  Error Message:', verifyErr.message);
        console.error('');

        if (verifyErr.code === 'EAUTH') {
            console.error('[ROOT CAUSE] Authentication failed.');
            console.error('  -> EMAIL_PASS is wrong. Use a Gmail App Password, not your account password.');
            console.error('  -> Ensure 2FA is enabled on your Google account first.');
        } else if (verifyErr.code === 'ECONNREFUSED' || verifyErr.code === 'ETIMEDOUT') {
            console.error('[ROOT CAUSE] Cannot reach SMTP server - NETWORK/FIREWALL issue.');
            console.error('  -> If running inside Docker, outbound port 587 may be blocked.');
            console.error('  -> Run this script OUTSIDE Docker on your host machine to test.');
            console.error('  -> Try port 465 with EMAIL_SECURE=true if port 587 is blocked.');
        } else if (verifyErr.code === 'ESOCKET') {
            console.error('[ROOT CAUSE] TLS/SSL socket error.');
            console.error('  -> For port 465: set EMAIL_SECURE=true in .env');
            console.error('  -> For port 587: keep EMAIL_SECURE=false (uses STARTTLS)');
        }

        process.exit(1);
    }

    // ── 5. Send a test OTP email ─────────────────────────────────────────
    console.log('[Step 2] Sending test OTP email to', emailUser, '...');

    try {
        const info = await transporter.sendMail({
            from: '"KisanSetu Test" <' + emailUser + '>',
            to: emailUser,
            subject: 'KisanSetu SMTP Test (OTP: 123456)',
            html: '<h2>KisanSetu SMTP Test</h2><p>Your Nodemailer config works!</p><h1 style="letter-spacing:8px;color:#1b5e20">123456</h1><p><em>Not a real OTP</em></p>'
        });

        console.log('[OK] TEST EMAIL SENT SUCCESSFULLY!');
        console.log('  Message ID:', info.messageId);
        console.log('  Check inbox at:', emailUser);
        console.log('');
        console.log('[SUMMARY] SMTP credentials are CORRECT.');
        console.log('  If OTPs still do not arrive in the app, see the audit report for other failure points.');
    } catch (sendErr) {
        console.error('[FAIL] sendMail failed even though verify passed!');
        console.error('  Error:', sendErr.message);
        console.error('  Full error:', JSON.stringify(sendErr, null, 2));
        process.exit(1);
    }
}

runTest().catch(err => {
    console.error('Unhandled error:', err);
    process.exit(1);
});
