import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, subject, html } = req.body;

    if (!to) {
      return res.status(400).json({ error: 'to is required' });
    }

    const data = await resend.emails.send({
      from: 'CyberQuote <onboarding@resend.dev>',
      to: [to],
      subject: subject || 'CyberQuote Alert',
      html: html || `<p>${subject}</p>`
    });

    res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}
