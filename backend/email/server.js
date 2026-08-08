// Email API Server
// Direct SMTP - reads config from Supabase database settings table

const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(cors());

// Supabase - MUST be set via environment variables
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing environment variables: SUPABASE_URL and SUPABASE_ANON_KEY are required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Cache settings for 5 minutes
let settingsCache = null;
let settingsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get settings from database
async function getSettings() {
  const now = Date.now();

  // Return cache if still valid
  if (settingsCache && (now - settingsCacheTime) < CACHE_TTL) {
    return settingsCache;
  }

  const { data, error } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from']);

  if (error) {
    console.error('Failed to fetch settings:', error);
    throw error;
  }

  settingsCache = {};
  for (const row of data || []) {
    settingsCache[row.key] = row.value;
  }
  settingsCacheTime = now;

  return settingsCache;
}

// Create transporter from settings
async function createTransporter() {
  const s = await getSettings();

  return nodemailer.createTransport({
    host: s.smtp_host || 'mail.cyberquote.co.id',
    port: parseInt(s.smtp_port || '465'),
    secure: s.smtp_port === '465', // SSL for 465
    auth: {
      user: s.smtp_user,
      pass: s.smtp_pass
    }
  });
}

// Health check
app.get('/health', async (req, res) => {
  try {
    const s = await getSettings();
    res.json({
      status: 'ok',
      smtp: s.smtp_host || 'mail.cyberquote.co.id',
      configured: !!(s.smtp_user && s.smtp_pass)
    });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// Send alert email
app.post('/alert', async (req, res) => {
  try {
    const { to, subject, html, priority, outlet_name, alert_type, severity } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'to is required' });
    }

    const s = await getSettings();
    const transporter = await createTransporter();

    const fromEmail = s.smtp_from || s.smtp_user;
    const alertTag = severity === 'P0_CRITICAL' ? '🚨 CRITICAL' :
                     severity === 'P1_HIGH' ? '⚠️ HIGH' :
                     severity === 'P2_MEDIUM' ? 'ℹ️ MEDIUM' : '📝 LOW';

    const emailHtml = html || `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; border-radius: 12px 12px 0 0;">
          <h1 style="color: white; margin: 0;">🚨 CyberQuote Alert</h1>
        </div>
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px;">
            <strong style="color: #dc2626;">${alertTag} ${subject || 'Alert'}</strong>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Outlet:</strong></td><td>${outlet_name || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Type:</strong></td><td>${alert_type || 'N/A'}</td></tr>
            <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Severity:</strong></td><td>${severity || 'N/A'}</td></tr>
          </table>
          <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
            Sent at: ${new Date().toISOString()}
          </p>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: fromEmail,
      to: to,
      subject: `[${severity || 'INFO'}] ${subject || 'CyberQuote Alert'}`,
      html: emailHtml
    });

    res.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted
    });

  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test email endpoint
app.post('/test', async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'to email required' });
    }

    const s = await getSettings();

    if (!s.smtp_user || !s.smtp_pass) {
      return res.status(400).json({
        success: false,
        error: 'SMTP credentials not configured. Please set smtp_user and smtp_pass in Settings.'
      });
    }

    const transporter = await createTransporter();

    const info = await transporter.sendMail({
      from: s.smtp_from || s.smtp_user,
      to: to,
      subject: 'CyberQuote Email Test',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #2563eb, #1d4ed8); padding: 20px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0;">🧪 CyberQuote Email Test</h1>
          </div>
          <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
            <p>Hello,</p>
            <p>This is a test email from <strong>CyberQuote</strong>.</p>
            <p>If you receive this, your email configuration is working!</p>
            <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
              Sent at: ${new Date().toISOString()}<br>
              SMTP: ${s.smtp_host}:${s.smtp_port}
            </p>
          </div>
        </div>
      `
    });

    res.json({
      success: true,
      message: `✅ Test email sent to ${to}`,
      messageId: info.messageId
    });

  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`📧 Email API running on port ${PORT}`);
  console.log(`   Supabase: ${SUPABASE_URL}`);
  console.log(`   Config: from database settings table`);
});
