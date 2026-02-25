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

// Parse Stripe webhook event — handle both raw body string and pre-parsed JSON
const event = $('Webhook').first().json.body
  ? JSON.parse($('Webhook').first().json.body)
  : $('Webhook').first().json;

const eventType = event.type;
const obj = event.data.object;
const now = new Date();
const sheetTs = now.toISOString().replace('T', ' ').substring(0, 19);
const sheetDate = sheetTs.substring(0, 10);

let sheet_row = null;
let meta_payload = null;

// ──────────────────────────────────────────────
// checkout.session.completed
// Fires when customer completes checkout (trial start or one-time purchase)
// ──────────────────────────────────────────────
if (eventType === 'checkout.session.completed') {
  const meta = obj.metadata || {};
  const sessionId = meta.session_id || null;
  const avatar = meta.avatar || null;
  const plan = meta.plan || null;
  const customerId = obj.customer || null;
  const email = obj.customer_email || obj.customer_details?.email || null;
  const amountTotal = obj.amount_total || 0;
  const revenue = amountTotal / 100;

  // Determine if this is a trial start or direct purchase
  // payment mode = lifetime (no trial), subscription mode with trial = trial
  const isPaymentMode = obj.mode === 'payment';
  const hasTrial = obj.subscription
    ? (obj.subscription_data?.trial_period_days > 0 || obj.payment_status === 'no_payment_required')
    : false;

  // If payment_status is 'no_payment_required' on a subscription, it means trial started
  // (Stripe doesn't charge during trial, so payment_status = 'no_payment_required')
  const isTrial = !isPaymentMode && (hasTrial || obj.payment_status === 'no_payment_required');
  const status = isTrial ? 'trial' : 'purchased';

  sheet_row = {
    session_id: sessionId,
    updated_at: sheetTs,
    Date: sheetDate,
    status: status,
    plan_selected: plan,
    revenue: revenue,
    stripe_customer_id: customerId,
    email: email,
    avatar: avatar,
  };

  // Set the appropriate timestamp column
  if (isTrial) {
    sheet_row.trial_started_at = sheetTs;
  } else {
    sheet_row.purchased_at = sheetTs;
  }

  // Meta CAPI: StartTrial or Purchase
  const capiEventName = isTrial ? 'StartTrial' : 'Purchase';

  meta_payload = {
    data: [{
      event_name: capiEventName,
      event_time: Math.floor(now.getTime() / 1000),
      event_id: (sessionId || customerId) + '_' + capiEventName.toLowerCase(),
      event_source_url: 'https://deenbuddy.vercel.app/quiz-funnel/',
      action_source: 'website',
      user_data: {
        em: email ? [sha256(email)] : undefined,
      },
      custom_data: {
        value: revenue,
        currency: 'USD',
        content_name: 'quiz_funnel',
        content_category: plan || 'unknown',
      }
    }]
  };
}

// ──────────────────────────────────────────────
// invoice.paid
// Fires when a subscription invoice is paid (trial conversion or renewal)
// ──────────────────────────────────────────────
else if (eventType === 'invoice.paid') {
  const email = obj.customer_email || null;
  const customerId = obj.customer || null;
  const amountPaid = obj.amount_paid || 0;
  const revenue = amountPaid / 100;

  // Skip $0 invoices (trial start invoices have amount_paid = 0)
  if (amountPaid === 0) {
    return [{ json: { event_type: eventType, skipped: true, reason: 'zero_amount_invoice' } }];
  }

  sheet_row = {
    stripe_customer_id: customerId,
    email: email,
    updated_at: sheetTs,
    Date: sheetDate,
    status: 'purchased',
    purchased_at: sheetTs,
    revenue: revenue,
  };

  meta_payload = {
    data: [{
      event_name: 'Purchase',
      event_time: Math.floor(now.getTime() / 1000),
      event_id: (obj.id || customerId) + '_purchase',
      event_source_url: 'https://deenbuddy.vercel.app/quiz-funnel/',
      action_source: 'website',
      user_data: {
        em: email ? [sha256(email)] : undefined,
      },
      custom_data: {
        value: revenue,
        currency: 'USD',
        content_name: 'quiz_funnel',
      }
    }]
  };
}

// ──────────────────────────────────────────────
// customer.subscription.deleted
// Fires when a subscription is cancelled / churned
// ──────────────────────────────────────────────
else if (eventType === 'customer.subscription.deleted') {
  const customerId = obj.customer || null;
  const email = obj.customer_email || null;

  sheet_row = {
    stripe_customer_id: customerId,
    email: email,
    updated_at: sheetTs,
    Date: sheetDate,
    status: 'churned',
  };

  // No Meta CAPI event for churn
  meta_payload = null;
}

// ──────────────────────────────────────────────
// Unhandled event type — pass through for logging
// ──────────────────────────────────────────────
else {
  return [{ json: { event_type: eventType, skipped: true, reason: 'unhandled_event_type' } }];
}

return [{ json: { event_type: eventType, sheet_row, meta_payload } }];
