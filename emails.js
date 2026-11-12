const fs = require('fs');
const path = require('path');

// Logos travel inside the email (cid:) so they show without a public URL or an "images hidden" prompt.
// Attachment shape is SendGrid's; gmail.js reads the same fields.
const LOGOS = [
  { file: 'assets/email-logo-re.png', content_id: 're-logo' },
  { file: 'assets/isn-logo.png', content_id: 'isn-logo' },
].map(({ file, content_id }) => ({
  content: fs.readFileSync(path.join(__dirname, file)).toString('base64'),
  filename: path.basename(file),
  type: 'image/png',
  disposition: 'inline',
  content_id,
}));

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FONT = "'IBM Plex Sans',Arial,Helvetica,sans-serif";
const HEAD_FONT = "'Archivo',Arial,Helvetica,sans-serif";
const PHONE = '(786) 823-3553';
const INTRO = "Thank you for your interest in Roof Engine! We're glad to have caught your attention and look forward to showing you what's possible when your business has the right sales engine working behind it.";

const p = (html) => `<p style="margin:0 0 18px;font-family:${FONT};font-size:16px;line-height:1.65;color:#3d4457;">${html}</p>`;
const button = (href, label) => `<a href="${esc(href)}" style="display:inline-block;background:#e8802a;color:#ffffff;font-family:${HEAD_FONT};font-weight:700;font-size:15px;line-height:1;text-decoration:none;padding:15px 26px;border-radius:9px;">${label}</a>`;
const panel = (inner, align = 'left') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f6f3;border-radius:12px;margin:4px 0 24px;"><tr><td align="${align}" style="padding:22px 24px;text-align:${align};">${inner}</td></tr></table>`;
const label = (t) => `<div style="font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#7a7f8c;margin:0 0 6px;">${t}</div>`;

function layout({ preheader, body }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<style>
  @media (max-width: 620px) { .px { padding-left: 22px !important; padding-right: 22px !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:#f7f6f3;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f7f6f3;">
  <tr><td align="center" style="padding:32px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 30px rgba(11,18,38,0.08);">
      <tr><td align="center" style="background:#0a1224;padding:26px 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:10px;"><tr>
          <td style="padding:6px 14px;"><img src="cid:re-logo" width="91" height="48" alt="Roof Engine" style="display:block;border:0;"></td>
          <td style="padding:6px 0;"><div style="width:1px;height:34px;background:#d5d7dc;"></div></td>
          <td style="padding:6px 14px;"><a href="https://isngs.com/"><img src="cid:isn-logo" width="73" height="28" alt="iSN Business Solutions" style="display:block;border:0;"></a></td>
        </tr></table>
      </td></tr>
      <tr><td class="px" style="padding:36px 40px 20px;">${body}</td></tr>
    </table>
    <div style="font-family:${FONT};font-size:12px;line-height:1.6;color:#8a8f9c;padding:20px 12px 0;">
      Roof Engine &middot; Powered by iSN Business Solutions<br>&copy; 2026 iSN. All rights reserved.
    </div>
  </td></tr>
</table>
</body>
</html>`;
}

// Confirmation to the person who filled in the form. Wording is Rebecca's; keep text and html saying the same thing.
function confirmationEmail({ firstName, company, serviceLabel, meetLink, scheduledLabel }) {
  const greeting = `<p style="margin:0 0 18px;font-family:${HEAD_FONT};font-size:22px;font-weight:800;color:#0b1226;">Hi ${esc(firstName)},</p>`;
  const signOff = `<p style="margin:8px 0 0;font-family:${FONT};font-size:16px;line-height:1.65;color:#3d4457;">Best Regards,<br><strong style="color:#0b1226;">Rebecca</strong></p>`;

  if (meetLink) {
    const confirmed = "Your call with our Marketing Expert is confirmed, and we're excited to connect, learn more about your business, and explore how Roof Engine can help turn more homeowner inquiries into booked inspections.";
    return {
      subject: 'Your Roof Engine Call is Confirmed!',
      text: [
        `Hi ${firstName},`, INTRO, confirmed,
        `Date & time: ${scheduledLabel}\nGoogle Meet: ${meetLink}`,
        'Looking forward to speaking with you!', 'Best Regards,\nRebecca',
      ].join('\n\n'),
      html: layout({
        preheader: `Your call is confirmed for ${scheduledLabel}.`,
        body: greeting + p(esc(INTRO)) + p(esc(confirmed))
          + panel(label('Date &amp; time')
            + `<div style="font-family:${HEAD_FONT};font-size:18px;font-weight:700;color:#0b1226;margin:0 0 18px;">${esc(scheduledLabel)}</div>`
            + button(meetLink, 'Join Google Meet &rarr;')
            + `<div style="font-family:${FONT};font-size:13px;line-height:1.5;color:#7a7f8c;margin-top:14px;">Google Meet: <a href="${esc(meetLink)}" style="color:#e8802a;word-break:break-all;">${esc(meetLink)}</a></div>`, 'center')
          + p('Looking forward to speaking with you!') + signOff,
      }),
      attachments: LOGOS,
    };
  }

  return {
    subject: "We've Received Your Roof Engine Inquiry!",
    text: [
      `Hi ${firstName},`, INTRO,
      `We've received your inquiry about ${serviceLabel}, and our Marketing Expert will be in touch shortly to learn more about ${company} and explore how Roof Engine can help turn more homeowner inquiries into booked inspections.`,
      `Can't wait? Give us a call at ${PHONE}.`,
      'Looking forward to speaking with you!', 'Best Regards,\nRebecca',
    ].join('\n\n'),
    html: layout({
      preheader: "We've received your inquiry. Our Marketing Expert will be in touch shortly.",
      body: greeting + p(esc(INTRO))
        + p(`We've received your inquiry about <strong style="color:#0b1226;">${esc(serviceLabel)}</strong>, and our Marketing Expert will be in touch shortly to learn more about <strong style="color:#0b1226;">${esc(company)}</strong> and explore how Roof Engine can help turn more homeowner inquiries into booked inspections.`)
        + panel(`<div style="font-family:${FONT};font-size:16px;line-height:1.5;color:#3d4457;margin:0 0 16px;">Can't wait? Give us a call at <a href="tel:+17868233553" style="color:#e8802a;text-decoration:none;font-weight:600;">${PHONE}</a>.</div>`
          + button('tel:+17868233553', `Call ${PHONE}`), 'center')
        + p('Looking forward to speaking with you!') + signOff,
    }),
    attachments: LOGOS,
  };
}

module.exports = { confirmationEmail };
