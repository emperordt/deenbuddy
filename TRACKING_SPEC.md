# Deen Buddy — Quiz Funnel Tracking Spec

Quiz URL: `deenbuddy.vercel.app/quiz-funnel/`

---

## 1. Client-Side Events to Fire

The quiz has a `window.trackQuizEvent(eventName, data)` hook. Implement this to POST to an n8n webhook.

Generate a `session_id` (UUID) on page load. Pass it through every event.

| Event | Trigger | Data |
|---|---|---|
| `PageView` | Page load | fbclid, fbc, fbp, IP, UA, referrer, session_id |
| `QuizStarted` | Click "Begin My Journey" | session_id |
| `QuizCompleted` | Processing animation finishes | session_id, avatar, all answer IDs |
| `EmailCaptured` | Email form submitted | session_id, email, avatar |
| `CheckoutInitiated` | Click pricing plan button | session_id, email, plan_selected, plan_value |
| `StartTrial` | Stripe webhook | email, stripe_customer_id, plan, value |
| `Purchase` | Stripe webhook | email, stripe_customer_id, value, currency |
| `HighAOVPurchaser` | Stripe webhook (all upsells bought) | email, total_value, currency |

---

## 2. Meta CAPI — Sending Events Back to Facebook

**Endpoint:**
```
POST https://graph.facebook.com/v21.0/{PIXEL_ID}/events?access_token={ACCESS_TOKEN}
```

Get Pixel ID + Access Token from Events Manager → Pixel → Settings → Conversions API → Generate Access Token.

**Event name mapping (use standard Meta events where possible):**

| Our Event | Meta event_name | Type |
|---|---|---|
| QuizStarted | `ViewContent` | Standard |
| QuizCompleted | `CompleteRegistration` | Standard |
| EmailCaptured | `Lead` | Standard |
| CheckoutInitiated | `InitiateCheckout` | Standard |
| Purchase | `Purchase` | Standard (include value) |
| HighAOVPurchaser | `HighAOVPurchaser` | Custom (register in Custom Conversions) |

**Payload format:**
```json
{
  "data": [
    {
      "event_name": "Lead",
      "event_time": 1738780000,
      "event_id": "{session_id}_lead",
      "event_source_url": "https://deenbuddy.vercel.app/quiz-funnel/",
      "action_source": "website",
      "user_data": {
        "em": ["SHA256_HASHED_EMAIL"],
        "client_ip_address": "x.x.x.x",
        "client_user_agent": "Mozilla/...",
        "fbc": "fb.1.1738...",
        "fbp": "fb.1.1738..."
      },
      "custom_data": {
        "value": 39.99,
        "currency": "USD",
        "content_name": "quiz_funnel",
        "content_category": "seeker"
      }
    }
  ]
}
```

**Critical details:**

1. **event_id** — Must be `{session_id}_{event_name}`. This deduplicates between browser pixel and server CAPI. Without it you get double-counted conversions.

2. **Email hashing** — SHA256 of lowercase, trimmed email:
```js
const crypto = require('crypto');
const hashed = crypto.createHash('sha256')
  .update(email.trim().toLowerCase())
  .digest('hex');
```

3. **event_time** — Unix timestamp in SECONDS (not ms). Must be within 7 days or Meta rejects it.

4. **Testing** — Use Events Manager → Test Events tab. Append `&test_event_code=TESTXXXXX` (your code from that tab) to the API call while testing. Events show in real-time without affecting production.

5. **Purchase + HighAOVPurchaser** — Always include `custom_data.value` and `custom_data.currency: "USD"`. This enables value-based optimization later.

---

## 3. n8n Workflows

### Workflow 1: Quiz Events (webhook receives POSTs from quiz page)

```
Receive POST →
  ├─ Upsert Google Sheets row by session_id
  ├─ Fire Meta CAPI event (HTTP Request node)
  └─ On EmailCaptured: also add to email tool (Klaviyo/Loops/Mailchimp)
     with tags: avatar type, quiz_complete, source: quiz_funnel
```

### Workflow 2: Stripe Webhooks

Listen for: `checkout.session.completed`, `customer.subscription.created`, `invoice.paid`

```
Receive Stripe webhook →
  ├─ Match Google Sheets row by email
  ├─ Update status + write stripe_customer_id + revenue_amount
  ├─ Fire Meta CAPI Purchase event with value
  └─ HighAOV check: if total revenue for this email >= $57,
     fire HighAOVPurchaser CAPI event + update Sheets status
```

---

## 4. Google Sheets Structure

### Sheet 1: `Raw Data` (n8n writes here — one row per user)

| Column | Example | Notes |
|---|---|---|
| session_id | a3f8b2c1-... | UUID from quiz page load |
| email | sarah@gmail.com | Blank until captured |
| avatar | seeker | seeker / believer / guardian |
| status | purchased | Latest funnel status |
| created_at | 2026-02-05 14:32 | First touch timestamp |
| updated_at | 2026-02-05 14:41 | Last status change |
| quiz_started_at | 2026-02-05 14:32 | |
| quiz_completed_at | 2026-02-05 14:35 | |
| email_captured_at | 2026-02-05 14:36 | |
| checkout_initiated_at | 2026-02-05 14:37 | |
| trial_started_at | 2026-02-05 14:38 | |
| purchased_at | 2026-02-05 14:41 | |
| plan_selected | annual | monthly / annual / lifetime |
| revenue | 39.99 | From Stripe |
| upsell_1 | TRUE | Bought upsell 1 |
| upsell_2 | TRUE | Bought upsell 2 |
| total_revenue | 64.99 | Main + all upsells |
| high_aov | TRUE | All upsells purchased |
| fbclid | fb.1.1738... | For CAPI matching |
| source | ig_story_ad_v2 | UTM source/campaign |
| answers_json | {"avatar":"seeker"...} | Full quiz answers |

**Status progression:** `quiz_started` → `quiz_completed` → `email_captured` → `checkout_initiated` → `trial` → `purchased` → `high_aov`

### Sheet 2: `Dashboard` (formulas — auto-calculates from Raw Data)

**Funnel metrics:**

| Stage | Count | Stage Conv Rate |
|---|---|---|
| Page Views | `=COUNTA(Raw!A:A)-1` | 100% |
| Quiz Started | `=COUNTIF(Raw!G:G,"<>")` | Started / Views |
| Quiz Completed | `=COUNTIF(Raw!H:H,"<>")` | Completed / Started |
| Email Captured | `=COUNTIF(Raw!I:I,"<>")` | Emails / Completed |
| Checkout Initiated | `=COUNTIF(Raw!J:J,"<>")` | Checkout / Emails |
| Trial Started | `=COUNTIF(Raw!K:K,"<>")` | Trial / Checkout |
| Purchased | `=COUNTIF(Raw!L:L,"<>")` | Purchased / Trial |
| High AOV | `=COUNTIF(Raw!R:R,TRUE)` | HighAOV / Purchased |

**Revenue metrics:**

| Metric | Formula |
|---|---|
| Total Revenue | `=SUM(Raw!Q:Q)` |
| AOV (all buyers) | `=AVERAGE(Raw!Q:Q)` |
| AOV (high AOV only) | `=AVERAGEIF(Raw!R:R, TRUE, Raw!Q:Q)` |
| Upsell 1 Take Rate | `=COUNTIF(Raw!O:O,TRUE) / COUNTIF(Raw!L:L,"<>")` |
| Upsell 2 Take Rate | `=COUNTIF(Raw!P:P,TRUE) / COUNTIF(Raw!L:L,"<>")` |

**Avatar breakdown (which persona converts best):**

| Metric | Seeker | Believer | Guardian |
|---|---|---|---|
| Started | `=COUNTIFS(Raw!C:C,"seeker",Raw!G:G,"<>")` | ... | ... |
| Emails | `=COUNTIFS(Raw!C:C,"seeker",Raw!I:I,"<>")` | ... | ... |
| Purchased | `=COUNTIFS(Raw!C:C,"seeker",Raw!L:L,"<>")` | ... | ... |
| Revenue | `=SUMIFS(Raw!Q:Q,Raw!C:C,"seeker")` | ... | ... |

**Daily trends (line chart this):**

| Date | Visitors | Emails | Purchases | Revenue |
|---|---|---|---|---|
| Formula per day using COUNTIFS with date range | | | | |

**Today's snapshot (big numbers at top):**

| Visitors Today | Emails Today | Purchases Today | Revenue Today |
|---|---|---|---|
| `=COUNTIFS(Raw!G:G,">="&TODAY())` | `=COUNTIFS(Raw!I:I,">="&TODAY())` | `=COUNTIFS(Raw!L:L,">="&TODAY())` | `=SUMIFS(Raw!Q:Q,Raw!L:L,">="&TODAY())` |

### Sheet 3: `Ad Performance` (optional)

| Campaign | Spend (manual) | Leads | Purchases | Revenue | CPA | ROAS |
|---|---|---|---|---|---|---|
| ig_story_v1 | $500 | formula | formula | formula | Spend/Purchases | Revenue/Spend |

---

## 5. Charts to Build in Dashboard Sheet

1. **Funnel bar chart** — horizontal bars showing dropoff at each stage
2. **Daily revenue line chart** — trending over time
3. **Avatar pie chart** — which segment converts most
4. **Conditional formatting** — green for rates above target, red for below

---

## 6. Key Metrics to Monitor Daily

1. Quiz Start → Email rate (target: 40%+)
2. Email → Purchase rate (money metric)
3. AOV (are upsells working?)
4. Avatar split (which persona to target more)
5. Daily revenue trend (growth?)
