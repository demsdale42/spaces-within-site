// Cloudflare Pages Function — handles POST /api/contact from contact.html's form.
//
// SETUP NEEDED (this is the one piece Bobby has to finish):
//   1. Create a free account at https://resend.com (or swap in whatever email
//      service you'd rather use — SendGrid, Postmark, etc. all work the same way,
//      just change the fetch() call below).
//   2. Verify a sending domain (or use Resend's onboarding@resend.dev sender for
//      testing before the domain is verified).
//   3. In the Cloudflare Pages project settings → Settings → Environment variables,
//      add a secret named RESEND_API_KEY with your Resend API key.
//   4. Redeploy. That's it — no code changes needed.
//
// Until RESEND_API_KEY is set, this function will return a clear error instead of
// silently swallowing form submissions, so it's obvious in testing that email
// sending isn't wired up yet.

export async function onRequestPost(context) {
  const { request, env } = context;

  let data;
  try {
    data = await request.json();
  } catch (err) {
    return json({ error: 'Invalid submission.' }, 400);
  }

  // Honeypot: bots fill hidden fields, real visitors never see them.
  if (data._hp) {
    return json({ ok: true }); // pretend success, drop silently
  }

  const email = (data.email || '').trim();
  if (!email || !email.includes('@')) {
    return json({ error: 'A valid email address is required.' }, 400);
  }

  const lines = [
    `Name: ${data.name || '(not provided)'}`,
    `Email: ${email}`,
    `Phone: ${data.phone || '(not provided)'}`,
    `City/Zip: ${data.location || '(not provided)'}`,
    ``,
    `What they've been noticing:`,
    data.noticing || '(not provided)',
    ``,
    `How they heard about us:`,
    data.source || '(not provided)',
  ].join('\n');

  if (!env.RESEND_API_KEY) {
    // Not configured yet — fail loudly rather than pretending this worked.
    console.error('RESEND_API_KEY is not set; contact form submission was not sent.', data);
    return json(
      { error: 'Email delivery is not configured yet on the server.' },
      500
    );
  }

  try {
    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Spaces Within Website <onboarding@resend.dev>', // swap for a verified sender once the domain is set up
        to: ['hello@thespaceswithin.com'],
        reply_to: email,
        subject: `New inquiry from ${data.name || 'the website'}`,
        text: lines,
      }),
    });

    if (!resendRes.ok) {
      const errText = await resendRes.text();
      console.error('Resend API error:', errText);
      return json({ error: 'Email delivery failed.' }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    console.error('Contact form send failed:', err);
    return json({ error: 'Unexpected error sending message.' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
