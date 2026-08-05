# WhatsApp Business API Application Guide

## CyberQuote MVP — Sprint 0

> Use this guide to apply for WhatsApp Business API access. For development, skip to the **Twilio Sandbox** section.

---

## Prerequisites

| Requirement | Details |
|-------------|---------|
| **Facebook Business Account** | Must be verified and have admin access |
| **Business Verification** | Completed via Meta Business Support Center |
| **Company Documentation** | Business registration, privacy policy URL |
| **Technical Contact** | Email for API correspondence |

---

## Step-by-Step Application Process

### Step 1: Create a Meta Business Account

1. Go to [business.facebook.com](https://business.facebook.com)
2. Click **Create Account**
3. Fill in business name, your name, and work email
4. Verify your email via the confirmation link

### Step 2: Verify Your Business

1. Navigate to **Business Settings** → **Security Center**
2. Click **Start Verification**
3. Submit required documents:
   - Business registration certificate
   - Government-issued ID (for the account admin)
   - Proof of address (utility bill, bank statement)
4. Wait for Meta review — typically 2–15 business days

### Step 3: Set Up WhatsApp Business Manager

1. Go to [business.facebook.com/wa/manage](https://business.facebook.com/wa/manage)
2. Click **Create WhatsApp Business Account**
3. Select your verified Meta Business Account
4. Fill in:
   - Business display name (must match your brand)
   - Business category
   - Business description
   - Timezone

### Step 4: Apply for WhatsApp Business API Access

1. In WhatsApp Business Manager, go to **Settings** → **WhatsApp Business API**
2. Click **Request API Access**
3. Choose your use case:
   - **Customer Support** (recommended for CyberQuote alerts)
   - **Notification Updates**
   - **E-commerce**
4. Submit additional details:
   - Privacy Policy URL (required)
   - Terms of Service URL
   - Use case description

### Step 5: Configure Phone Number

1. Add a dedicated phone number (do NOT use your personal number)
2. Verify via SMS or voice call
3. Note: The number must be able to receive SMS/calls

### Step 6: Set Up Payment Method

1. Add a credit card or PayPal in Meta Business Settings
2. Understand the conversation-based pricing model

---

## Required Documents Checklist

- [ ] Business registration document
- [ ] Proof of business address
- [ ] Admin's government-issued ID
- [ ] Privacy Policy URL (hosted, publicly accessible)
- [ ] Terms of Service URL
- [ ] Website URL

---

## Timeline

| Phase | Duration |
|-------|----------|
| Business verification | 2–15 business days |
| WhatsApp Business Account setup | 1–2 days |
| API access approval | 5–10 business days |
| **Total estimated** | **2–4 weeks** |

---

## Cost Structure

| Component | Cost |
|-----------|------|
| Monthly fee | $0 (free tier) |
| Per conversation | $0.005–$0.09 depending on country |
| Business verification | Free |

> **Note**: WhatsApp uses conversation-based pricing. A conversation starts when you message a customer and lasts 24 hours.

---

## Alternative: Twilio WhatsApp Sandbox (Development)

For development and testing, use Twilio's WhatsApp sandbox:

### Setup

1. Create account at [twilio.com](https://www.twilio.com)
2. Navigate to **Develop** → **Sandboxes** → **WhatsApp**
3. Note your sandbox number and code
4. Send the code via SMS to opt-in

### Pros
- Immediate access (no verification wait)
- Free during development
- Works with any phone number

### Cons
- Shows "Sent from Twilio Sandbox" in messages
- Limited to development/testing
- Not suitable for production

### Configuration for Development

```bash
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_ACCOUNT_SID=<your-sid>
```

### Transitioning to Production API

1. Complete the full Meta application process
2. Update `WHATSAPP_FROM` to your approved number
3. Remove Twilio sandbox credentials
4. Test with a small group before full rollout

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Business verification stuck | Check email for additional document requests |
| Display name rejected | Must match legal business name or brand |
| API access denied | Appeal with detailed use case description |
| Phone number issues | Use a dedicated line (not personal) |

---

## Assigned Owner

- **PM**: [Assign in project tracker]
- **Target submission date**: Sprint 0, Week 2
- **Status**: Not Started
