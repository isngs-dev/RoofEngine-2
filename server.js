const express = require('express');
const sgMail = require('@sendgrid/mail');

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
  const { name, company, email, phone, service, message } = req.body || {};
  if (!name || !company || !email || !phone || !service) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const serviceLabel = SERVICE_LABELS[service] || service;

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
    ].join('\n'),
  };

  const userEmail = {
    to: email,
    from: FROM_EMAIL,
    subject: 'We got your Roof Engine inquiry',
    text: `Hi ${name},\n\nThanks for reaching out about ${serviceLabel.toLowerCase()}. We'll be in touch shortly to show you what Roof Engine could look like for ${company}.\n\n— Roof Engine`,
  };

  try {
    await Promise.all([sgMail.send(adminEmail), sgMail.send(userEmail)]);
    res.json({ ok: true });
  } catch (err) {
    console.error('SendGrid error:', err.response ? err.response.body : err.message);
    res.status(502).json({ error: 'Failed to send email' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
