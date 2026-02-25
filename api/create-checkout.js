const Stripe = require('stripe');

module.exports = async function handler(req, res) {
  // CORS headers (same-origin but belt + suspenders)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('[create-checkout] STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const {
    plan,
    price_id,
    email,
    session_id,
    avatar,
    first_name,
    source,
    // Tracking passthrough
    fbclid,
    fbc,
    fbp,
    browser_id,
    client_ip,
    user_agent,
  } = req.body;

  // Get user's real IP from request headers (fallback to body)
  const realIp = client_ip || req.headers['x-forwarded-for'] || '';
  const realUa = user_agent || req.headers['user-agent'] || '';

  if (!price_id) {
    return res.status(400).json({ error: 'price_id is required' });
  }

  // Build return URL — user goes to upsell-1 after checkout
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const baseUrl = protocol + '://' + host;
  const returnUrl =
    baseUrl +
    '/quiz-funnel/upsell-1.html?cs={CHECKOUT_SESSION_ID}' +
    '&sid=' + encodeURIComponent(session_id || '') +
    '&plan=' + encodeURIComponent(plan || '');

  try {
    const sessionParams = {
      ui_mode: 'embedded',
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email || undefined,
      line_items: [{ price: price_id, quantity: 1 }],
      return_url: returnUrl,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          session_id: session_id || '',
          plan: plan || '',
          source: source || '',
        },
      },
      metadata: {
        email: email || '',
        session_id: session_id || '',
        avatar: avatar || '',
        first_name: first_name || '',
        plan: plan || '',
        source: source || '',
        fbclid: fbclid || '',
        fbc: fbc || '',
        fbp: fbp || '',
        browser_id: browser_id || '',
        client_ip: realIp,
        user_agent: (realUa || '').substring(0, 500),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionParams);

    return res.status(200).json({ client_secret: session.client_secret });
  } catch (err) {
    console.error('[create-checkout] Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
