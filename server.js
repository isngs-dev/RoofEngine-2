require('dotenv').config();
const express = require('express');
const sgMail = require('@sendgrid/mail');
const { createMeetEvent } = require('./calendar');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const ADMIN_EMAIL = 'paid@isngs.com';
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

const SERVICE_LABELS = {
  google_ads: 'Google Ads (PPC)',
  meta_ads: 'Meta Ads',
  seo: 'Search Engine Marketing (SEO)',
  smm: 'Social Media Marketing (SMM)',
  website_dev: 'Website Development',
  other: 'Other',
};

app.post('/api/contact', async (req, res) => {
  const { name, company, email, phone, service, message, booking } = req.body || {};
  if (!name || !company || !email || !phone || !service) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const serviceLabel = SERVICE_LABELS[service] || service;

  let meetLink = null;
  let scheduledLabel = null;
  if (booking && booking.date && booking.time) {
    try {
      const start = new Date(`${booking.date}T${booking.time}:00`);
      const end = new Date(start.getTime() + 30 * 60000);
      const timeZone = booking.timeZone || 'UTC';
      meetLink = await createMeetEvent({
        summary: `Roof Engine call — ${name} (${company})`,
        description: `Service: ${serviceLabel}\nPhone: ${phone}\nMessage: ${message || '—'}`,
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        timeZone,
        guestEmail: email,
      });
      scheduledLabel = `${booking.date} at ${booking.time} (${timeZone})`;
    } catch (err) {
      console.error('Calendar error:', err.response ? err.response.data : err.message);
      return res.status(502).json({ error: 'Could not book the call. Please try again or choose email only.' });
    }
  }

  const adminEmail = {
    to: ADMIN_EMAIL,
    from: FROM_EMAIL,
    replyTo: email,
    subject: `New Roof Engine inquiry — ${name} (${company})`,
    text: [
      `Name: ${name}`,
      `Company: ${company}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Service: ${serviceLabel}`,
      `Message: ${message || '—'}`,
      scheduledLabel ? `Call scheduled: ${scheduledLabel}` : null,
      meetLink ? `Meet link: ${meetLink}` : null,
    ].filter(Boolean).join('\n'),
  };

  const userEmail = {
    to: email,
    from: FROM_EMAIL,
    subject: meetLink ? 'Your Roof Engine call is booked' : 'We got your Roof Engine inquiry',
    text: meetLink
      ? `Hi ${name},\n\nYour call is booked for ${scheduledLabel}.\nJoin here: ${meetLink}\n\n— Roof Engine`
      : `Hi ${name},\n\nThanks for reaching out about ${serviceLabel.toLowerCase()}. We'll be in touch shortly to show you what Roof Engine could look like for ${company}.\n\n— Roof Engine`,
  };

  try {
    await Promise.all([sgMail.send(adminEmail), sgMail.send(userEmail)]);
    res.json({ ok: true, meetLink });
  } catch (err) {
    console.error('SendGrid error:', err.response ? err.response.body : err.message);
    res.status(502).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
