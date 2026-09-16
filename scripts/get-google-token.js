// One-time local script to get a Google refresh token for the account that
// should organize the booking calls (kaustubh.b1@isngs.com).
//
// Usage:
//   Fill in GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env, then:
//   npm run get-google-token
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

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: ['https://www.googleapis.com/auth/calendar.events'],
});

console.log('\n1. Open this URL and sign in as kaustubh.b1@isngs.com:\n');
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
  console.log('Save this as the GOOGLE_REFRESH_TOKEN environment variable on Render:\n');
  console.log(tokens.refresh_token);
});

server.listen(PORT);
