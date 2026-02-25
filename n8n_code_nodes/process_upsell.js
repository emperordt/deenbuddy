function sha256(str) {
  if (!str) return null;
  str = str.toString().toLowerCase().trim();
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  var mathPow = Math.pow;
  var maxWord = mathPow(2, 32);
  var lengthProperty = 'length';
  var i, j;
  var result = '';
  var words = [];
  var asciiBitLength = str[lengthProperty] * 8;
  var hash = [];
  var k = [];
  var primeCounter = 0;
  var isComposite = {};
  for (var candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) { isComposite[i] = candidate; }
      hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1/3) * maxWord) | 0;
    }
  }
  str += '\x80';
  while (str[lengthProperty] % 64 - 56) str += '\x00';
  for (i = 0; i < str[lengthProperty]; i++) {
    j = str.charCodeAt(i);
    if (j >> 8) return;
    words[i >> 2] |= j << ((3 - i) % 4) * 8;
  }
  words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
  words[words[lengthProperty]] = (asciiBitLength);
  for (j = 0; j < words[lengthProperty];) {
    var w = words.slice(j, j += 16);
    var oldHash = hash;
    hash = hash.slice(0, 8);
    for (i = 0; i < 64; i++) {
      var w15 = w[i - 15], w2 = w[i - 2];
      var a = hash[0], e = hash[4];
      var temp1 = hash[7] + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) | 0);
      var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
    }
    for (i = 0; i < 8; i++) { hash[i] = (hash[i] + oldHash[i]) | 0; }
  }
  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      var b = (hash[i] >> (j * 8)) & 255;
      result += ((b < 16) ? '0' : '') + b.toString(16);
    }
  }
  return result;
}

// Step 1 data: original webhook from upsell page
const wb = JSON.parse($('Webhook').first().json.body);

// Step 2 data: Stripe checkout session (has customer ID)
const checkoutSession = $('Get Checkout Session').first().json;

// Step 3 data: customer's payment methods
const paymentMethods = $('Get Payment Methods').first().json;

// Extract customer ID from checkout session
const customerId = checkoutSession.customer;

// Get the default payment method from the list
// payment_methods.data is an array — grab the first one (most recent)
const pmData = paymentMethods.data || [];
const paymentMethodId = pmData.length > 0 ? pmData[0].id : null;

// Upsell pricing map (amounts in cents for Stripe)
const upsellPricing = {
  'oto1_lifetime':  { cents: 4700, dollars: 47.00 },
  'oto1_annual':    { cents: 4700, dollars: 47.00 },
  'oto2_lifetime':  { cents: 2700, dollars: 27.00 },
  'oto2_annual':    { cents: 2700, dollars: 27.00 },
  'oto3_lifetime':  { cents: 1700, dollars: 17.00 },
  'oto3_annual':    { cents: 1700, dollars: 17.00 },
};

const upsellName = wb.upsell_name || 'oto1_lifetime';
const pricing = upsellPricing[upsellName] || { cents: 0, dollars: 0 };

const eventTime = wb.event_time || Math.floor(Date.now() / 1000);

// Build Stripe PaymentIntent request (form-urlencoded params)
const stripe_request = {
  'amount': pricing.cents,
  'currency': 'usd',
  'customer': customerId,
  'payment_method': paymentMethodId,
  'confirm': true,
  'off_session': true,
  'metadata[session_id]': wb.session_id,
  'metadata[upsell_name]': upsellName,
};

// Info for downstream nodes (sheet update, CAPI)
const upsell_info = {
  session_id: wb.session_id,
  upsell_name: upsellName,
  amount_dollars: pricing.dollars,
  customer_id: customerId,
  email: wb.email || checkoutSession.customer_email || checkoutSession.customer_details?.email || null,
  event_time: eventTime,
  client_ip: wb.client_ip || null,
  user_agent: wb.user_agent || null,
  browser_id: wb.browser_id || null,
  fbc: wb.fbc || null,
  fbp: wb.fbp || null,
};

// Meta CAPI Purchase event for the upsell
const meta_payload = {
  data: [{
    event_name: 'Purchase',
    event_time: Math.floor(eventTime),
    event_id: wb.session_id + '_' + upsellName,
    event_source_url: 'https://deenbuddy.vercel.app/quiz-funnel/',
    action_source: 'website',
    user_data: {
      em: upsell_info.email ? [sha256(upsell_info.email)] : undefined,
      fbc: wb.fbc || undefined,
      fbp: wb.fbp || undefined,
      external_id: wb.browser_id ? [wb.browser_id] : undefined,
      client_ip_address: wb.client_ip || undefined,
      client_user_agent: wb.user_agent || undefined,
    },
    custom_data: {
      value: pricing.dollars,
      currency: 'USD',
      content_name: 'quiz_funnel',
      content_category: upsellName,
    }
  }]
};

return [{ json: { stripe_request, upsell_info, meta_payload } }];
