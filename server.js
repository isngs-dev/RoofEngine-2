require('dotenv').config();
const express = require('express');
const sgMail = require('@sendgrid/mail');
const { createMeetEvent } = require('./calendar');
const { saveInquiry } = require('./supabase');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const ADMIN_EMAILS = ['paid@isngs.com', 'kaustubh.b1@isngs.com'];
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL;

const SERVICE_LABELS = {
  google_ads: 'Google Ads (PPC)',
  meta_ads: 'Meta Ads',
  seo: 'Search Engine Marketing (SEO)',
  smm: 'Social Media Marketing (SMM)',
  website_dev: 'Website Development',
  other: 'Other',
};

// Bookable call times, Eastern Time (24h). Keep in sync with BOOKING_SLOTS in index.html.
const BOOKING_SLOTS = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];

app.post('/api/contact', async (req, res) => {
  const { name, company, email, phone, service, message, booking } = req.body || {};
  if (!name || !company || !email || !phone || !service) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const serviceLabel = SERVICE_LABELS[service] || service;

  let meetLink = null;
  let scheduledLabel = null;
  if (booking && booking.date && booking.time) {
    const day = new Date(`${booking.date}T12:00:00Z`).getUTCDay();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.date) || !BOOKING_SLOTS.includes(booking.time) || day === 0 || day === 6) {
      return res.status(400).json({ error: 'Please choose an available weekday and time.' });
    }
    booking.timeZone = 'America/New_York';
    try {
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
    await Promise.all([sgMail.send(adminEmail), sgMail.send(userEmail)]);
    res.json({ ok: true, meetLink });
  } catch (err) {
    console.error('SendGrid error:', err.response ? err.response.body : err.message);
    res.status(502).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
