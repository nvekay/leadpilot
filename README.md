# LeadPilot

AI lead intake: inbound emails and website form leads are parsed and scored by Claude, synced to HubSpot
(contact, company, deal), and answered with a drafted reply once a human approves it in the app or in Slack.

NestJS · BullMQ (Redis) · PostgreSQL (Drizzle) · Next.js · Claude API · HubSpot · Slack

> Work in progress.

## Run locally

Requires Node 22+, pnpm and Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up            # Postgres and Redis in Docker
pnpm build && pnpm db:migrate
pnpm dev              # API on :4000, web on :3000
```
