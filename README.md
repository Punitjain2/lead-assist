# AI lead-response and site-visit booking assistant

Take-home build for a residential developer brief: an assistant that answers every
enquiry in seconds (English, Hindi, Gujarati), answers only from the sales head's fact
sheet, books site visits into genuinely free slots with no double booking, and hands
serious buyers to a named executive with a chat summary. Staff get a unified lead list
with duplicate detection, a handoff queue, a reminders outbox and a source dashboard.

- **TDD.md**: architecture, data model, AI design, decisions, assumptions, limits
- **deployment.md**: run it locally in 4 commands, env var names, demo logins

Quick start: `npm install && cp .env.example .env` (add your key)
`&& npx prisma db push && npm run db:seed && npm run dev`

No Anthropic key handy? Set `MOCK_AI="1"` in `.env` for a clearly-labelled scripted
demo assistant that runs the same booking, consent and handoff plumbing keyless.

Tests (`npm test`) include the concurrent double-booking race: six simultaneous
requests at a 2-seat slot, exactly two succeed.
