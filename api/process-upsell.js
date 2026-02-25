const Stripe = require('stripe');

module.exports = async function handler(req, res) {
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
    console.error('[process-upsell] STRIPE_SECRET_KEY not set');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const { checkout_session_id, session_id, upsell_name, amount, product } = req.body;

  // Capture user's real IP + UA from the browser request
  const realIp = req.headers['x-forwarded-for'] || '';
  const realUa = req.headers['user-agent'] || '';

  if (!checkout_session_id) {
    return res.status(400).json({ success: false, message: 'checkout_session_id is required' });
  }
  if (!amount) {
    return res.status(400).json({ success: false, message: 'amount is required' });
  }

  // Map upsell names to Stripe product IDs for clean Zapier/webhook identification
  const PRODUCT_MAP = {
    oto1_lifetime:  process.env.STRIPE_PRODUCT_OTO1  || '',
    oto2_ramadan:   process.env.STRIPE_PRODUCT_OTO2  || '',
    ds2_ramadan:    process.env.STRIPE_PRODUCT_DS2   || '',
    oto3_library:   process.env.STRIPE_PRODUCT_OTO3  || '',
    ds3_verses:     process.env.STRIPE_PRODUCT_DS3   || '',
  };

  try {
    // 1. Retrieve the original checkout session to get customer ID
    const checkoutSession = await stripe.checkout.sessions.retrieve(checkout_session_id);
    const customerId = checkoutSession.customer;

    if (!customerId) {
      return res.status(400).json({ success: false, message: 'No customer found on checkout session' });
    }

    // 2. Get the customer's payment methods (saved from checkout)
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
      limit: 1,
    });

    if (!paymentMethods.data.length) {
      return res.status(400).json({ success: false, message: 'No saved payment method found' });
    }

    const paymentMethodId = paymentMethods.data[0].id;

    // 3. Create and confirm PaymentIntent — one-click charge
    const intentParams = {
      amount: amount,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      description: product || upsell_name || 'DeenBuddy Upsell',
      metadata: {
        session_id: session_id || '',
        upsell_name: upsell_name || '',
        product: product || '',
        checkout_session_id: checkout_session_id,
        client_ip: realIp,
        user_agent: (realUa || '').substring(0, 500),
      },
    };

    // Attach Stripe product for clean webhook/Zapier identification
    const stripeProductId = PRODUCT_MAP[upsell_name];
    if (stripeProductId) {
      intentParams.metadata.stripe_product_id = stripeProductId;
    }

    const paymentIntent = await stripe.paymentIntents.create(intentParams);

    if (paymentIntent.status === 'succeeded') {
      return res.status(200).json({ success: true });
    } else {
      return res.status(200).json({
        success: false,
        message: 'Payment status: ' + paymentIntent.status,
      });
    }
  } catch (err) {
    console.error('[process-upsell] Error:', err.message);
    return res.status(200).json({
      success: false,
      message: err.message || 'Payment failed',
    });
  }
};
