# deployment.md

## Run locally, step by step

Requires Node 18+. An AI key is optional: a keyless demo mode is described below.

```bash
git clone https://github.com/Punitjain2/lead-assist
cd lead-assist
npm install
cp .env.example .env        # then open .env and fill the values below
npx prisma db push          # creates the local SQLite database
npm run db:seed             # loads 62 leads, 2 fact sheets, slots, users
npm run dev                 # http://localhost:3000
```

Run the tests (includes the concurrent double-booking race test):

```bash
npm test
```

Reset the demo data at any time with `npm run db:seed`.

### Try it without an Anthropic key

Set `MOCK_AI="1"` in `.env` (and leave `ANTHROPIC_API_KEY` empty). The chat then runs a
scripted demo assistant that drives the same server functions as the real agent: fact-
sheet answers with the RERA number, name/phone/consent capture, duplicate check, free-
slot listing, the atomic booking, reminders, and all three handoff guardrails (discount,
ask-for-a-person, missing fact). The chat shows a visible "Demo mode" note so nobody
mistakes it for the AI. Set `MOCK_AI=""` and add a real key for the full assistant,
including free-form questions and Hindi/Gujarati.

## How it is deployed

Live at https://lead-assist-i48z.vercel.app : Vercel (app) + Neon Postgres (database),
with Sarvam (`sarvam-105b`) as the AI provider via the option-C variables below.

- App on Vercel (Next.js 14, App Router). Connect the GitHub repo, framework auto-detected.
- Database: the repo ships with SQLite for zero-friction local review. For the hosted
  deployment, switch `provider = "postgresql"` in `prisma/schema.prisma`, point
  `DATABASE_URL` at a free Neon or Supabase Postgres, then run
  `npx prisma db push && npm run db:seed` once against it. The atomic booking SQL is
  identical on both engines.
- No cron needed for the demo: reminder sends are triggered from the Messages screen.
  In production, a Vercel Cron hits a small route that runs the same `runDueSends` logic
  every 5 minutes.

## Environment variables (names only)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Database connection string |
| `ANTHROPIC_API_KEY` | Claude API key (option B) |
| `AI_API_KEY` | Key for an OpenAI-compatible provider (option C) |
| `AI_BASE_URL` | Provider base URL for option C |
| `AI_MODEL` | Model name for option C |
| `MOCK_AI` | "1" runs the scripted keyless demo assistant |
| `AUTH_SECRET` | Long random string signing the session cookie |
| `ANTHROPIC_MODEL` | Optional model override |
| `APP_URL` | Optional, base URL in production (used by logout redirect) |

The assistant's brain is provider-agnostic. Priority order: `MOCK_AI="1"` (scripted
demo, no key) > `ANTHROPIC_API_KEY` (Claude) > `AI_API_KEY` with `AI_BASE_URL` +
`AI_MODEL` (any OpenAI-compatible provider: Sarvam, Mistral, Groq, Gemini, OpenRouter,
OpenAI; ready-made settings for each are in `.env.example`). If no brain is configured
or the API errors, the chat does not break: the buyer gets a polite message and the
lead is handed to a named sales executive automatically.

## Demo logins (password for all: `demo1234`)

| Role | Email | Sees |
|---|---|---|
| Sales head | head@demo.in | Everything, plus fact-sheet editor and slot manager |
| Sales executive | exec1@demo.in | Leads, handoffs, dashboard, messages |

The buyer needs no login: open `/` and press "Chat with us".

## 2-minute reviewer tour

1. `/chat`: ask "2 BHK price in Anandam Skyview?", then "kitna discount milega?"
   (watch it refuse and hand off), then "book a site visit" and follow the flow.
2. Sign in as head@demo.in: Leads (note the amber duplicate badges), the handed-off
   lead LD-58211 with its Hindi chat and summary, Dashboard, Messages
   (press "Send due now"), Fact sheets (edit a line, ask the chat again).
