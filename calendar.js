const { google } = require('googleapis');
const crypto = require('crypto');

const ORGANIZER_EMAIL = 'kaustubh.b1@isngs.com';
const ORGANIZER_GUEST = 'ahad.m@isngs.com';

function getOAuthClient() {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}

// Creates the event on kaustubh.b1@isngs.com's calendar (the account behind
// GOOGLE_REFRESH_TOKEN) so that account is automatically the organizer.
async function createMeetEvent({ summary, description, startISO, endISO, timeZone, guestEmail }) {
  const calendar = google.calendar({ version: 'v3', auth: getOAuthClient() });
  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    requestBody: {
      summary,
      description,
      start: { dateTime: startISO, timeZone },
      end: { dateTime: endISO, timeZone },
      attendees: [
        { email: guestEmail },
        { email: ORGANIZER_GUEST },
        { email: ORGANIZER_EMAIL, responseStatus: 'accepted' },
      ],
      conferenceData: {
        createRequest: {
          requestId: crypto.randomUUID(),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
    },
  });
  return data.hangoutLink;
}

module.exports = { createMeetEvent };
