const { google } = require('googleapis');
const { getOAuthClient } = require('./calendar');

// Header values come from the form, so strip line breaks to stop header injection.
const header = (v) => String(v).replace(/[\r\n]+/g, ' ');
const encodeWord = (v) => `=?UTF-8?B?${Buffer.from(header(v)).toString('base64')}?=`;

function buildRaw({ to, from, replyTo, subject, text }) {
  const lines = [
    from ? `From: ${header(from)}` : null,
    `To: ${[].concat(to).map(header).join(', ')}`,
    replyTo ? `Reply-To: ${header(replyTo)}` : null,
    `Subject: ${encodeWord(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(text).toString('base64').replace(/.{76}/g, '$&\r\n'),
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
