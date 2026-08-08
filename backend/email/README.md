# Email Backend (Node.js)

Direct SMTP email sending - no Supabase Edge Functions needed.

## Setup

```bash
cd backend/email
cp .env.example .env
# Edit .env with your SMTP credentials
npm install
```

## Run

```bash
node server.js
```

## API Endpoints

### POST /test
Test email sending
```json
{
  "to": "test@example.com"
}
```

### POST /send
Send custom email
```json
{
  "to": "recipient@example.com",
  "subject": "Alert Title",
  "html": "<h1>Email Content</h1>",
  "from": "optional@custom.com"
}
```

## Deploy Options

### Option 1: VPS/Server
```bash
pm2 start server.js
```

### Option 2: Render.com (Free)
1. Connect repo to Render
2. Set build command: `npm install`
3. Set start command: `node server.js`
4. Add env vars from .env

### Option 3: Railway.app
Same as Render - simple Node.js deployment.

## .env Configuration

```
PORT=3001
SMTP_HOST=mail.cyberquote.co.id
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=stefanus.gilang@cyberquote.co.id
SMTP_PASS=your_password
```
