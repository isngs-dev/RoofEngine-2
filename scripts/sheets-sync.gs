// Google Apps Script for the "Roof Engine inquiries" sheet.
// Supabase calls this (Database Webhook on INSERT into public.inquiries) and it
// appends the new row. Setup steps are in scripts/SHEETS-SYNC.md.

const HEADERS = ['Submitted At', 'Name', 'Company', 'Email', 'Phone', 'Service', 'Message',
  'Call Date', 'Call Time', 'Time Zone', 'Google Meet Link'];

// Keep in sync with SERVICE_LABELS in server.js.
const SERVICE_LABELS = {
  google_ads: 'Google Ads (PPC)',
  meta_ads: 'Meta Ads',
  seo: 'Search Engine Marketing (SEO)',
  smm: 'Social Media Marketing (SMM)',
  website_dev: 'Website Development',
  other: 'Other',
};

function doPost(e) {
  if (!e) throw new Error('doPost only runs when Supabase calls the web app URL. To test from the editor, pick testSync and press Run.');
  const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  if (!token || e.parameter.token !== token) return reply({ error: 'unauthorized' });

  const payload = JSON.parse(e.postData.contents);
  if (payload.type !== 'INSERT' || payload.table !== 'inquiries') return reply({ ignored: true });

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  sheet.appendRow(toRow(payload.record));
  return reply({ ok: true });
}

function toRow(r) {
  return [
    r.created_at ? new Date(r.created_at) : new Date(),
    r.name, r.company, r.email, r.phone,
    SERVICE_LABELS[r.service] || r.service,
    r.message || '',
    r.booking_date || '', r.booking_time || '', r.booking_timezone || '',
    r.meet_link || '',
  ].map(v => (typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v)); // stop formula injection from form text
}

// Run this from the editor: fakes a Supabase webhook call and appends a test row.
function testSync() {
  const token = PropertiesService.getScriptProperties().getProperty('SYNC_TOKEN');
  const record = {
    created_at: new Date().toISOString(), name: 'TEST - delete me', company: 'Sheets sync test',
    email: 'test@example.com', phone: '(555) 000-0000', service: 'other', message: 'Editor test',
    booking_date: '2026-10-30', booking_time: '10:00', booking_timezone: 'America/New_York',
    meet_link: 'https://meet.google.com/test-sync-row',
  };
  const out = doPost({ parameter: { token }, postData: { contents: JSON.stringify({ type: 'INSERT', table: 'inquiries', record }) } });
  Logger.log(token ? out.getContent() : 'SYNC_TOKEN is not set in Project Settings → Script Properties');
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
