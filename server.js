require('dotenv').config();
const express = require('express');
const sgMail = require('@sendgrid/mail');
const { createMeetEvent, getAvailability, upcomingWeekdays } = require('./calendar');
const { sendGmail } = require('./gmail');
const { saveInquiry } = require('./supabase');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const ADMIN_EMAILS = ['paid@isngs.com', 'kaustubh.b1@isngs.com'];
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

// Gmail keeps a copy in info@isngs.com's Sent folder; SendGrid is the fallback until GMAIL_REFRESH_TOKEN is set.
const sendMail = process.env.GMAIL_REFRESH_TOKEN ? sendGmail : (msg) => sgMail.send(msg);

const SERVICE_LABELS = {
  google_ads: 'Google Ads (PPC)',
  meta_ads: 'Meta Ads',
  seo: 'Search Engine Marketing (SEO)',
  smm: 'Social Media Marketing (SMM)',
  website_dev: 'Website Development',
  other: 'Other',
};

app.get('/api/availability', async (req, res) => {
  try {
    res.json(await getAvailability());
  } catch (err) {
    console.error('Availability error:', err.response ? err.response.data : err.message);
    res.status(502).json({ error: 'Could not load available times.' });
  }
});

app.post('/api/contact', async (req, res) => {
  const { name, company, email, phone, service, message, booking } = req.body || {};
  if (!name || !company || !email || !phone || !service) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const serviceLabel = SERVICE_LABELS[service] || service;

  let meetLink = null;
  let scheduledLabel = null;
  if (booking && booking.date && booking.time) {
    if (!upcomingWeekdays().includes(booking.date)) {
      return res.status(400).json({ error: 'Please choose an available weekday and time.' });
    }
    booking.timeZone = 'America/New_York';
    try {
      // Checked again here so a slot taken since the visitor opened the picker can't be double-booked.
      if (!(await getAvailability([booking.date]))[booking.date].includes(booking.time)) {
        return res.status(409).json({ error: 'That time is no longer available. Please pick another.' });
      }
      // Local times plus timeZone, so Google places the call in Eastern Time whatever the server's zone.
      const [h, m] = booking.time.split(':').map(Number);
      const endMin = h * 60 + m + 30;
      const endTime = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
      meetLink = await createMeetEvent({
        summary: `Roof Engine call — ${name} (${company})`,
        description: `Service: ${serviceLabel}\nPhone: ${phone}\nMessage: ${message || '—'}`,
        startISO: `${booking.date}T${booking.time}:00`,
        endISO: `${booking.date}T${endTime}:00`,
        timeZone: booking.timeZone,
        guestEmail: email,
      });
      scheduledLabel = `${booking.date} at ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'} ET`;
    } catch (err) {
      console.error('Calendar error:', err.response ? err.response.data : err.message);
      return res.status(502).json({ error: 'Could not book the call. Please try again or choose email only.' });
    }
  }

  await saveInquiry({ name, company, email, phone, service, message, meetLink, booking });

  const adminEmail = {
    to: ADMIN_EMAILS,
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
    await Promise.all([sendMail(adminEmail), sendMail(userEmail)]);
    res.json({ ok: true, meetLink });
  } catch (err) {
    console.error('Email error:', err.response ? err.response.body || err.response.data : err.message);
    res.status(502).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
