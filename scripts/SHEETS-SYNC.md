# Supabase → Google Sheets sync

Every new row in `public.inquiries` (one per form submission, with the Meet link when a call was booked) is pushed by a Supabase Database Webhook to an Apps Script attached to the sheet, which appends it.

Sheet: https://docs.google.com/spreadsheets/d/1pY7U-EZQRriNm5LZi2clVmcNfl4NzfdV_lyfknKlRmQ/edit

## 1. Apps Script (in the sheet)

1. Open the sheet → **Extensions → Apps Script**.
2. Replace `Code.gs` with the contents of [`sheets-sync.gs`](sheets-sync.gs) and save.
3. **Project Settings → Script Properties → Add**: `SYNC_TOKEN` = a long random string (e.g. run `node -e "console.log(crypto.randomUUID())"`).
4. **Deploy → New deployment → Web app**: Execute as **Me**, Who has access **Anyone**. Authorize, then copy the web app URL (`https://script.google.com/macros/s/…/exec`).

## 2. Supabase webhook

Supabase Dashboard → **Integrations** (main left sidebar, not under Database) → **Database Webhooks** → enable it if asked → **Webhooks → Create a new hook**:

- Table: `inquiries`, Events: **Insert**
- Type: **HTTP Request**, Method: **POST**
- URL: the web app URL
- HTTP Parameters: `token` = the same `SYNC_TOKEN`

Or, without the UI, run this in **SQL Editor** (replace the URL and token):

```sql
create extension if not exists pg_net;

create or replace function public.push_inquiry_to_sheet() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?token=YOUR_SYNC_TOKEN',
    body := jsonb_build_object('type', 'INSERT', 'table', 'inquiries', 'schema', 'public', 'record', to_jsonb(new)),
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  return new;
end $$;

create trigger inquiries_to_sheet
  after insert on public.inquiries
  for each row execute function public.push_inquiry_to_sheet();
```

## 3. Check

Submit the form once. A row appears in the first tab (headers are added automatically if it's empty). The webhook log in Supabase may show a `302` — that's Apps Script's normal redirect; the row is still written.

Rows created before the webhook existed aren't copied. To backfill, export `inquiries` as CSV from the Supabase Table Editor and paste it in.

If you change the script later, use **Deploy → Manage deployments → Edit → New version** so the URL stays the same.
