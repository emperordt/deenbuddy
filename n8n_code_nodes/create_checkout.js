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

const wb = JSON.parse($('Webhook').first().json.body);

const ts = new Date(wb.event_time * 1000);
const sheetTs = ts.toISOString().replace('T', ' ').substring(0, 19);

// Determine if lifetime (one-time payment) or subscription (monthly/annual)
const isLifetime = wb.plan === 'lifetime';
const mode = isLifetime ? 'payment' : 'subscription';

// Build the return_url
// Lifetime buyers skip OTO1 (upsell-1) and go straight to upsell-2
const returnPage = isLifetime ? 'upsell-2.html' : 'upsell-1.html';
const returnUrl = `https://deenbuddy.vercel.app/quiz-funnel/${returnPage}?cs={CHECKOUT_SESSION_ID}&sid=${wb.session_id}&plan=${wb.plan}`;

// Build Stripe checkout session request (form-urlencoded params)
const stripe_request = {
  'mode': mode,
  'line_items[0][price]': wb.price_id,
  'line_items[0][quantity]': 1,
  'ui_mode': 'embedded',
  'customer_email': wb.email,
  'metadata[session_id]': wb.session_id,
  'metadata[avatar]': wb.avatar || '',
  'metadata[plan]': wb.plan,
  'return_url': returnUrl,
};

// Subscriptions get a 7-day free trial
if (!isLifetime) {
  stripe_request['subscription_data[trial_period_days]'] = 7;
}

// Google Sheets row for upsert
const sheet_row = {
  session_id: wb.session_id,
  updated_at: sheetTs,
  Date: sheetTs.substring(0, 10),
  checkout_initiated_at: sheetTs,
  status: 'checkout_initiated',
  plan_selected: wb.plan,
};

// Meta CAPI InitiateCheckout event
const meta_payload = {
  data: [{
    event_name: 'InitiateCheckout',
    event_time: Math.floor(wb.event_time),
    event_id: wb.session_id + '_initiate_checkout',
    event_source_url: 'https://deenbuddy.vercel.app/quiz-funnel/',
    action_source: 'website',
    user_data: {
      em: wb.email ? [sha256(wb.email)] : undefined,
      fbc: wb.fbc || undefined,
      fbp: wb.fbp || undefined,
      external_id: wb.browser_id ? [wb.browser_id] : undefined,
      client_ip_address: wb.client_ip || undefined,
      client_user_agent: wb.user_agent || undefined,
    },
    custom_data: {
      content_name: 'quiz_funnel',
      content_category: wb.avatar || 'unknown',
      currency: 'USD',
    }
  }]
};

return [{ json: { stripe_request, sheet_row, meta_payload } }];
