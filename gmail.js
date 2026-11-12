const crypto = require('crypto');
const { google } = require('googleapis');
const { getOAuthClient } = require('./calendar');

// Header values come from the form, so strip line breaks to stop header injection.
const header = (v) => String(v).replace(/[\r\n]+/g, ' ');
const encodeWord = (v) => `=?UTF-8?B?${Buffer.from(header(v)).toString('base64')}?=`;
const wrap = (b64) => b64.replace(/.{76}/g, '$&\r\n');
const part = (contentType, b64, extra = []) =>
  [`Content-Type: ${contentType}`, 'Content-Transfer-Encoding: base64', ...extra, '', wrap(b64)].join('\r\n');
const multipart = (type, parts) => {
  const boundary = `${type}_${crypto.randomUUID()}`;
  return [`Content-Type: multipart/${type}; boundary="${boundary}"`, '', ...parts.flatMap((p) => [`--${boundary}`, p]), `--${boundary}--`].join('\r\n');
};

// Text only, or (with html) text + html alternatives wrapped with inline cid: images.
// attachments use SendGrid's shape: { content (base64), filename, type, content_id }.
function buildRaw({ to, from, replyTo, subject, text, html, attachments = [] }) {
  const textPart = part('text/plain; charset=UTF-8', Buffer.from(text).toString('base64'));
  const body = !html ? textPart : multipart('related', [
    multipart('alternative', [textPart, part('text/html; charset=UTF-8', Buffer.from(html).toString('base64'))]),
    ...attachments.map((a) => part(`${a.type}; name="${a.filename}"`, a.content,
      [`Content-ID: <${a.content_id}>`, `Content-Disposition: inline; filename="${a.filename}"`])),
  ]);
  const lines = [
    from ? `From: ${header(from)}` : null,
    `To: ${[].concat(to).map(header).join(', ')}`,
    replyTo ? `Reply-To: ${header(replyTo)}` : null,
    `Subject: ${encodeWord(subject)}`,
    'MIME-Version: 1.0',
    body,
  ].filter((l) => l !== null);
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

// Sends as the account behind GMAIL_REFRESH_TOKEN (info@isngs.com), so Gmail keeps a copy in its Sent folder.
// From is left out so Gmail fills in that account's own address (SENDGRID_FROM_EMAIL may differ).
async function sendGmail(msg) {
  const gmail = google.gmail({ version: 'v1', auth: getOAuthClient(process.env.GMAIL_REFRESH_TOKEN) });
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw: buildRaw({ ...msg, from: null }) } });
}

module.exports = { sendGmail, buildRaw };
