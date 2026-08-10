# Module: FloatingChat.tsx

Floating AI chat button + window. Fixed header accessibility (140px → 50px after user adjustment). 221 lines.

## Responsibilities

- Floating button (bottom-right, fixed position)
- Expandable chat window with minimize/close
- POST to `athena-chat` edge function
- Display message history with user/assistant bubbles
- Loading spinner during AI response

## Key Fixes

- **Notification dot** — was covering header buttons. Fixed: `pointer-events-none`
- **Header height** — reduced from 140px/100px to 50px (compact)
- **Z-index** — buttons now `relative z-10` to ensure clickability
- **Chat window** — `pointer-events-none` when closed (not visible)

## Button Layout (header, 50px height)

```
┌──────────────────────────────────────────────┐
│ 🤖 AI Assistant        │ [Minimize] [✕ Close] │
└──────────────────────────────────────────────┘
```

## State

```typescript
isOpen: boolean     // window visible
isMinimized: boolean // window collapsed to header only
messages: Message[]  // chat history
input: string        // current input
isLoading: boolean  // AI processing
```

## API Call

```typescript
POST ${EDGE_FUNCTIONS_URL}/athena-chat
Headers: Authorization: Bearer <user_jwt_token>
Body: { message: string, history: messages[-6] }
```

## Related

- [`src/components/ChatPanel.tsx`](src/components/ChatPanel.tsx) — full sidebar chat (separate, has quick prompts)
