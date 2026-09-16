const { createClient } = require('@supabase/supabase-js');

let client = null;
function getClient() {
  if (client) return client;
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  return client;
}

// Stores one contact-form submission. Never throws — a DB hiccup shouldn't
// stop the customer's confirmation email from going out.
async function saveInquiry({ name, company, email, phone, service, message, meetLink, booking }) {
  const supabase = getClient();
  if (!supabase) {
    console.error('Supabase not configured — skipping save.');
    return;
  }
  const { error } = await supabase.from('inquiries').insert({
    name,
    company,
    email,
    phone,
    service,
    message: message || null,
    meet_link: meetLink || null,
    booking_date: booking ? booking.date : null,
    booking_time: booking ? booking.time : null,
    booking_timezone: booking ? booking.timeZone : null,
  });
  if (error) console.error('Supabase insert error:', error.message);
}

module.exports = { saveInquiry };
