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

const wb = JSON.parse($('EmailCapture').first().json.body);
const geo = $('IP Geo Lookup4').first().json || {};

const ts = new Date(wb.event_time * 1000);
const sheetTs = ts.toISOString().replace('T', ' ').substring(0, 19);

const meta_payload = {
  data: [{
    event_name: "Lead",
    event_time: wb.event_time,
    event_id: wb.event_id,
    event_source_url: wb.source_url || "https://deenbuddy-liard.vercel.app/quiz-funnel/",
    action_source: "website",
    user_data: {
      em: wb.email ? [sha256(wb.email)] : undefined,
      fn: wb.first_name ? [sha256(wb.first_name)] : undefined,
      fbc: wb.fbc || undefined,
      fbp: wb.fbp || undefined,
      external_id: wb.browser_id ? [wb.browser_id] : undefined,
      client_ip_address: wb.client_ip || undefined,
      client_user_agent: wb.user_agent || undefined,
      ct: geo.city ? [sha256(geo.city)] : undefined,
      st: geo.regionName ? [sha256(geo.regionName)] : undefined,
      zp: geo.zip ? [sha256(geo.zip)] : undefined,
      country: geo.countryCode ? [sha256(geo.countryCode)] : undefined,
    },
    custom_data: {
      content_name: "quiz_funnel",
      content_category: wb.avatar || "unknown",
    }
  }]
};

const sheet_row = {
  session_id: wb.session_id,
  updated_at: sheetTs,
  Date: sheetTs.substring(0, 10),
  email_captured_at: sheetTs,
  status: "email_captured",
  email: wb.email,
  first_name: wb.first_name || null,
  avatar: wb.avatar,
};

return [{ json: { meta_payload, sheet_row } }];
