// One-time local script to get a Google refresh token.
//
// Usage:
//   Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then:
//   npm run get-google-token            -> GOOGLE_REFRESH_TOKEN (kaustubh.b1@isngs.com, calendar)
//   npm run get-google-token -- gmail   -> GMAIL_REFRESH_TOKEN (info@isngs.com, sending email)
//
// The Google Cloud OAuth client must have this exact redirect URI added:
//   http://localhost:4321/oauth2callback

require('dotenv').config();
const http = require('http');
const { google } = require('googleapis');

const PORT = 4321;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET before running this.');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  REDIRECT_URI
);

const target = process.argv[2] === 'gmail'
  ? { account: 'info@isngs.com', envVar: 'GMAIL_REFRESH_TOKEN', scope: 'https://www.googleapis.com/auth/gmail.send' }
  : { account: 'kaustubh.b1@isngs.com', envVar: 'GOOGLE_REFRESH_TOKEN', scope: 'https://www.googleapis.com/auth/calendar.events' };

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  login_hint: target.account,
  scope: [target.scope],
});

console.log(`\n1. Open this URL and sign in as ${target.account}:\n`);
console.log(authUrl);
console.log('\n2. Approve access. You will be redirected back here automatically.\n');

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith('/oauth2callback')) {
    res.end();
    return;
  }
  const code = new URL(req.url, REDIRECT_URI).searchParams.get('code');
  res.end('Done — you can close this tab and go back to the terminal.');
  server.close();

  const { tokens } = await oauth2Client.getToken(code);
  console.log(`Save this as the ${target.envVar} environment variable on Render:\n`);
  console.log(tokens.refresh_token);
});

server.listen(PORT);
