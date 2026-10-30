# Supabase → Google Sheets sync

An Apps Script attached to the sheet checks Supabase every minute and appends any new rows from `public.inquiries` (one per form submission, with the Meet link when a call was booked).

It pulls instead of Supabase pushing because the isngs.com Workspace doesn't allow public Apps Script web apps, so a Supabase webhook gets `401`.

Sheet: https://docs.google.com/spreadsheets/d/1pY7U-EZQRriNm5LZi2clVmcNfl4NzfdV_lyfknKlRmQ/edit

## 1. Supabase (SQL Editor)

Pick a new random token (e.g. `node -e "console.log(crypto.randomUUID())"`), put it in place of `PASTE_SYNC_TOKEN`, and run:

```sql
-- The old push webhook can't reach Apps Script; remove it.
drop trigger if exists roofengine on public.inquiries;

-- Lets the sheet read inquiries with the public anon key, but only with the token.
create or replace function public.inquiries_for_sheet(p_token text, p_since timestamptz)
returns setof public.inquiries
language sql stable security definer set search_path = public
as $$
  select * from public.inquiries
  where p_token = 'PASTE_SYNC_TOKEN' and created_at > p_since
  order by created_at
  limit 500;
$$;

revoke execute on function public.inquiries_for_sheet(text, timestamptz) from public;
grant execute on function public.inquiries_for_sheet(text, timestamptz) to anon;
```

## 2. Apps Script (in the sheet)

1. Open the sheet → **Extensions → Apps Script**, replace the code with [`sheets-sync.gs`](sheets-sync.gs), save.
2. **Project Settings → Script Properties**, set:
   - `SUPABASE_URL` — Supabase **Project Settings → Data API** (e.g. `https://xxxx.supabase.co`)
   - `SUPABASE_ANON_KEY` — Supabase **Project Settings → API Keys**: the *publishable* / *anon* key (never the service role key)
   - `SYNC_TOKEN` — the same token as in the SQL
   - delete `LAST_CREATED_AT` if it exists
3. Clear the sheet's test rows (keep or delete the header row — it's re-added if the sheet is empty).
4. Pick **setup** in the function dropdown → **Run** → approve the permissions. It copies every existing inquiry and installs a trigger that runs `syncInquiries` every minute.

The web app deployment isn't used any more; you can archive it under **Deploy → Manage deployments**.

## 3. Check

**Executions** shows `syncInquiries` every minute with "New inquiries: N" in its log. A new form submission shows up in the sheet within about a minute.

To copy everything again from scratch: clear the sheet, delete the `LAST_CREATED_AT` property, run `syncInquiries`.
