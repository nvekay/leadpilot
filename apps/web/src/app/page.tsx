import { ArrowRight, Check, Database, Mail, MessageSquare, Send, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';
import { Logo } from '@/components/logo';
import { api } from '@/lib/api';
import { QuoteForm } from './quote-form';
import { SampleCards } from './sample-cards';

export const dynamic = 'force-dynamic';

const STEPS = [
  { icon: Mail, title: 'Email or form arrives', text: 'Webhook in, stored once even if delivered twice.' },
  { icon: Sparkles, title: 'Claude reads it', text: 'Contact, company, budget, timeline, services, language.' },
  { icon: Target, title: 'Rules score it', text: 'Points for budget, fit and market, each with a reason.' },
  { icon: Database, title: 'HubSpot is updated', text: 'Contact by email, company by domain, a new deal.' },
  { icon: MessageSquare, title: 'A person approves', text: 'Edit the drafted reply, approve here or in Slack.' },
  { icon: Send, title: 'Reply goes out', text: 'Logged on the deal. One approval, one email.' },
];

const ENGINEERING = [
  [
    'Background jobs',
    'each step is a BullMQ job on Redis, retried 5 times with backoff, then parked for a one-click retry.',
  ],
  [
    'Exactly once',
    'webhooks and form submits are idempotent; steps move the lead with conditional updates; email sends carry an idempotency key.',
  ],
  [
    'Safe with untrusted text',
    'emails are data, not instructions: strict output schemas, rule-based scoring, draft checks and human approval.',
  ],
  [
    'CRM hygiene',
    'existing contacts are matched by email and only empty fields are filled; companies are matched by domain.',
  ],
  [
    'Measured',
    'a labelled set of 30 emails in 5 languages scores extraction accuracy; every model call records tokens and cost.',
  ],
  [
    'Tested',
    'unit tests plus integration tests against real Postgres, Redis and the queue worker: outages, retries, double clicks, forged Slack calls.',
  ],
];

export default async function HomePage() {
  const samples = await api.demoSamples();

  return (
    <div className="min-h-dvh">
      <header className="border-b border-ink-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <Logo />
          <div className="flex items-center gap-2">
            <a
              href="https://github.com/nvekay/leadpilot"
              className="hidden h-9 items-center rounded-lg px-3 text-sm text-ink-600 hover:bg-ink-50 hover:text-ink-900 sm:inline-flex"
            >
              Source code
            </a>
            <Link
              href="/inbox"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-ink-900 px-3.5 text-sm font-medium text-white hover:bg-ink-700"
            >
              Open the inbox <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-14 pb-10 sm:px-8 lg:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden /> Live demo · Claude · HubSpot · Slack
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl leading-[1.05] font-semibold sm:text-6xl">
            Every inbound lead read, scored and in your CRM within a minute.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-600">
            LeadPilot reads emails and website forms with AI, scores them against your ideal customer, creates the
            contact, company and deal in HubSpot, and drafts a reply. Nothing is sent until a person approves it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#try"
              className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-5 text-sm font-medium text-white shadow-sm hover:bg-accent-strong"
            >
              Send a test lead <ArrowRight className="size-4" aria-hidden />
            </a>
            <Link
              href="/inbox"
              className="inline-flex h-11 items-center rounded-lg border border-ink-200 px-5 text-sm font-medium shadow-sm hover:bg-ink-50"
            >
              See the inbox
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 sm:px-8" aria-label="How it works">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl border border-ink-200 bg-ink-50/50 p-4">
                <div className="flex items-center justify-between">
                  <s.icon className="size-5 text-accent" aria-hidden />
                  <span className="font-mono text-xs text-ink-400">{i + 1}</span>
                </div>
                <p className="mt-3 text-sm font-semibold">{s.title}</p>
                <p className="mt-1 text-sm text-ink-600">{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="try" className="mx-auto max-w-6xl scroll-mt-6 px-4 pt-20 sm:px-8">
          <h2 className="text-3xl font-semibold">Try it</h2>
          <p className="mt-2 max-w-2xl text-ink-600">
            You are the sales team of Northwind Studio, a fictional software agency. Send one of these emails, or fill
            in the agency&apos;s quote form, then watch the lead move through the pipeline.
          </p>
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink-500">Sample emails</h3>
              <SampleCards samples={samples} />
            </div>
            <div>
              <h3 className="mb-3 text-sm font-semibold text-ink-500">Or write your own</h3>
              <div className="rounded-xl border border-ink-200 p-5 shadow-sm">
                <p className="mb-4 font-semibold">Northwind Studio · Get a quote</p>
                <QuoteForm />
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-8">
          <div className="rounded-2xl bg-ink-900 p-6 text-ink-100 sm:p-10">
            <h2 className="text-2xl font-semibold text-white">Under the hood</h2>
            <p className="mt-1 text-sm text-ink-400">
              NestJS · BullMQ on Redis · PostgreSQL with Drizzle · Next.js · Claude API · HubSpot · Slack · Resend
            </p>
            <ul className="mt-6 grid gap-x-10 gap-y-4 md:grid-cols-2">
              {ENGINEERING.map(([title, text]) => (
                <li key={title} className="flex gap-3 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
                  <span>
                    <span className="font-semibold text-white">{title}:</span> {text}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink-200">
        <p className="mx-auto max-w-6xl px-4 py-6 text-sm text-ink-500 sm:px-8">
          A demo project. Northwind Studio and the sample senders are fictional; replies go to a test inbox, never to
          real people.
        </p>
      </footer>
    </div>
  );
}
