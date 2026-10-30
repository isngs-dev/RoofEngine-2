// Google Apps Script for the "iSN RoofEngine Leads" sheet.
// Every minute it asks Supabase for inquiries newer than the last one copied and
// appends them. (isngs.com Workspace blocks public web apps, so Supabase can't push.)
// Setup steps are in scripts/SHEETS-SYNC.md.
// Script Properties: SUPABASE_URL, SUPABASE_ANON_KEY, SYNC_TOKEN. LAST_CREATED_AT is managed here.

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

// Run once from the editor: installs the every-minute trigger and copies everything so far.
function setup() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncInquiries').timeBased().everyMinutes(1).create();
  syncInquiries();
}

// ponytail: cursor is created_at, so a row whose insert commits after a newer row was
// already copied gets skipped; fine at form-submission volume, track ids if that changes.
function syncInquiries() {
  const props = PropertiesService.getScriptProperties();
  const p = props.getProperties();
  const res = UrlFetchApp.fetch(p.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/rpc/inquiries_for_sheet', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: p.SUPABASE_ANON_KEY },
    payload: JSON.stringify({ p_token: p.SYNC_TOKEN, p_since: p.LAST_CREATED_AT || '1970-01-01T00:00:00Z' }),
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) throw new Error('Supabase ' + res.getResponseCode() + ': ' + res.getContentText());

  const records = JSON.parse(res.getContentText());
  Logger.log('New inquiries: ' + records.length);
  if (!records.length) return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  sheet.getRange(sheet.getLastRow() + 1, 1, records.length, HEADERS.length).setValues(records.map(toRow));
  props.setProperty('LAST_CREATED_AT', records[records.length - 1].created_at);
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
