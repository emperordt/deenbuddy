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

  if (!checkout_session_id) {
    return res.status(400).json({ success: false, message: 'checkout_session_id is required' });
  }
  if (!amount) {
    return res.status(400).json({ success: false, message: 'amount is required' });
  }

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
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      off_session: true,
      metadata: {
        session_id: session_id || '',
        upsell_name: upsell_name || '',
        product: product || '',
        checkout_session_id: checkout_session_id,
      },
    });

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
