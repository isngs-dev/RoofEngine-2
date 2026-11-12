const { google } = require('googleapis');
const crypto = require('crypto');

const ORGANIZER_EMAIL = 'kaustubh.b1@isngs.com';
const ORGANIZER_GUEST = 'ahad.m@isngs.com';

const TZ = 'America/New_York';
// Bookable call times, Eastern Time (24h); each call is 30 minutes.
const BOOKING_SLOTS = ['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30'];
const SLOT_MS = 30 * 60000;
const WEEKDAYS_OFFERED = 10;

function getOAuthClient(refreshToken = process.env.GOOGLE_REFRESH_TOKEN) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// Creates the event on kaustubh.b1@isngs.com's calendar (the account behind
// GOOGLE_REFRESH_TOKEN) so that account is automatically the organizer.
// `guest` ({ firstName, company }) is stored on the event so reminders can be sent later.
async function createMeetEvent({ summary, description, startISO, endISO, timeZone, guestEmail, guest }) {
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
      extendedProperties: { private: { roofEngine: '1', email: guestEmail, ...guest } },
      attendees: [
        { email: guestEmail, responseStatus: 'accepted' },
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

// The moment a New York wall-clock time happens (EST or EDT, whichever applies that day).
function etInstant(date, time) {
  const guess = new Date(`${date}T${time}:00Z`);
  const wall = new Date(guess.toLocaleString('sv-SE', { timeZone: TZ }).replace(' ', 'T') + 'Z');
  return new Date(guess.getTime() + (guess - wall));
}

// The next WEEKDAYS_OFFERED Mon–Fri dates in New York, starting today.
function upcomingWeekdays() {
  const d = new Date(new Date().toLocaleString('sv-SE', { timeZone: TZ }).slice(0, 10) + 'T12:00:00Z');
  const out = [];
  while (out.length < WEEKDAYS_OFFERED) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// Events that block time on Kaustubh's calendar: not marked "Free", not declined by him.
async function busyIntervals(from, to) {
  const calendar = google.calendar({ version: 'v3', auth: getOAuthClient() });
  const { data } = await calendar.events.list({
    calendarId: 'primary', timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: true, maxResults: 2500,
  });
  return (data.items || [])
    .filter((e) => e.status !== 'cancelled' && e.transparency !== 'transparent'
      && !(e.attendees || []).some((a) => a.self && a.responseStatus === 'declined'))
    .map((e) => [
      e.start.dateTime ? new Date(e.start.dateTime) : etInstant(e.start.date, '00:00'),
      e.end.dateTime ? new Date(e.end.dateTime) : etInstant(e.end.date, '00:00'),
    ]);
}

// { 'YYYY-MM-DD': ['06:00', ...] }: slots still in the future that don't overlap a busy event.
async function getAvailability(dates = upcomingWeekdays()) {
  const busy = await busyIntervals(etInstant(dates[0], '00:00'), etInstant(dates[dates.length - 1], '23:59'));
  const now = Date.now();
  return Object.fromEntries(dates.map((date) => [date, BOOKING_SLOTS.filter((t) => {
    const start = etInstant(date, t).getTime();
    return start > now && !busy.some(([s, e]) => s < start + SLOT_MS && e > start);
  })]));
}

// Calls booked through the site (tagged by createMeetEvent) that haven't ended and start within `hours`.
// The calendar is the record: if Kaustubh moves or deletes the event, reminders follow.
async function upcomingCalls(hours) {
  const calendar = google.calendar({ version: 'v3', auth: getOAuthClient() });
  const now = new Date();
  const { data } = await calendar.events.list({
    calendarId: 'primary', timeMin: now.toISOString(), timeMax: new Date(now.getTime() + hours * 3600000).toISOString(),
    singleEvents: true, privateExtendedProperty: 'roofEngine=1',
  });
  return data.items || [];
}

// Records a sent reminder on the event itself, so restarts and redeploys never send it twice.
async function markEvent(event, flags) {
  const calendar = google.calendar({ version: 'v3', auth: getOAuthClient() });
  await calendar.events.patch({
    calendarId: 'primary', eventId: event.id, sendUpdates: 'none',
    requestBody: { extendedProperties: { private: { ...event.extendedProperties.private, ...flags } } },
  });
}

// "Friday, November 13 at 10:30 AM ET"
const callLabel = (dateTime) => `${new Date(dateTime).toLocaleString('en-US', {
  timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit',
})} ET`;

module.exports = { createMeetEvent, getOAuthClient, getAvailability, upcomingWeekdays, upcomingCalls, markEvent, callLabel };
