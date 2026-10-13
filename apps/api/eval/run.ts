// Measures extraction and draft quality on the labelled dataset with the real models.
// Usage: pnpm --filter @leadpilot/api eval   (needs ANTHROPIC_API_KEY in the repo's .env)
import { checkDraft, type LeadAnalysis } from '@leadpilot/shared';
import { writeFileSync } from 'node:fs';
import { ClaudeLeadAi } from '../src/ai/claude-lead-ai.js';
import type { Lead } from '../src/db/schema.js';
import { DEFAULT_SETTINGS } from '../src/settings/settings.service.js';
import { DATASET, type EvalCase } from './dataset.js';

const key = process.env.ANTHROPIC_API_KEY;
if (!key) throw new Error('Set ANTHROPIC_API_KEY in .env');
const models = {
  analyze: process.env.ANALYZE_MODEL ?? 'claude-haiku-5-5',
  draft: process.env.DRAFT_MODEL ?? 'claude-sonnet-5-5',
};
const ai = new ClaudeLeadAi(key, models);
const { calendarUrl, replySignature } = DEFAULT_SETTINGS;

type Field = 'category' | 'budget' | 'country' | 'language' | 'suspicious';
interface Result {
  c: EvalCase;
  analysis?: LeadAnalysis;
  checks: Partial<Record<Field, boolean>>;
  draftWarnings?: string[];
  costUsd: number;
  ms: number;
  error?: string;
}

const budgetOk = (expected: number | null, a: LeadAnalysis) => {
  const got = a.budgetUsd?.max ?? a.budgetUsd?.min ?? null;
  if (expected === null || got === null) return expected === got;
  // Currency conversion makes exact figures meaningless; within 15% counts as right
  return Math.abs(got - expected) / expected <= 0.15;
};

async function runCase(c: EvalCase): Promise<Result> {
  const started = Date.now();
  try {
    const { analysis, usage } = await ai.analyze(c);
    const e = c.expected;
    const categories = Array.isArray(e.category) ? e.category : [e.category];
    const checks: Result['checks'] = { category: categories.includes(analysis.category) };
    if (e.budgetMaxUsd !== undefined) checks.budget = budgetOk(e.budgetMaxUsd, analysis);
    if (e.country !== undefined) checks.country = (analysis.company.country?.toUpperCase() ?? null) === e.country;
    if (e.language !== undefined) checks.language = analysis.language.toLowerCase().startsWith(e.language);
    if (e.suspicious !== undefined) checks.suspicious = analysis.suspiciousInstructions === e.suspicious;

    let costUsd = usage.costUsd;
    let draftWarnings: string[] | undefined;
    if (analysis.category === 'sales_lead') {
      const lead = { ...c, id: c.id, fromName: c.fromName } as unknown as Lead;
      const draft = await ai.draftReply({ lead, analysis, calendarUrl, signature: replySignature });
      draftWarnings = checkDraft(draft.text, { calendarUrl, senderEmail: c.fromEmail });
      costUsd += draft.usage.costUsd;
    }
    return { c, analysis, checks, draftWarnings, costUsd, ms: Date.now() - started };
  } catch (err) {
    return { c, checks: {}, costUsd: 0, ms: Date.now() - started, error: String(err) };
  }
}

// A few at a time keeps within rate limits
const results: Result[] = [];
for (let i = 0; i < DATASET.length; i += 4) {
  results.push(...(await Promise.all(DATASET.slice(i, i + 4).map(runCase))));
  process.stdout.write(`${results.length}/${DATASET.length}\r`);
}

const fields: Field[] = ['category', 'budget', 'country', 'language', 'suspicious'];
const rows = fields.map((f) => {
  const scored = results.filter((r) => r.checks[f] !== undefined);
  const right = scored.filter((r) => r.checks[f]).length;
  return { field: f, right, total: scored.length, pct: scored.length ? (100 * right) / scored.length : 0 };
});
const drafts = results.filter((r) => r.draftWarnings);
const cleanDrafts = drafts.filter((r) => r.draftWarnings!.length === 0).length;
const cost = results.reduce((s, r) => s + r.costUsd, 0);
const sortedMs = results.map((r) => r.ms).sort((a, b) => a - b);
const p50 = sortedMs[Math.floor(sortedMs.length / 2)] ?? 0;
const errors = results.filter((r) => r.error);
const misses = results.flatMap((r) =>
  fields
    .filter((f) => r.checks[f] === false)
    .map((f) => {
      const a = r.analysis!;
      const got = {
        category: a.category,
        budget: JSON.stringify(a.budgetUsd),
        country: a.company.country,
        language: a.language,
        suspicious: a.suspiciousInstructions,
      }[f];
      return `| ${r.c.id} | ${f} | ${JSON.stringify(f === 'budget' ? r.c.expected.budgetMaxUsd : f === 'category' ? r.c.expected.category : r.c.expected[f])} | ${String(got)} |`;
    }),
);

const report = [
  `# Extraction eval`,
  ``,
  `${DATASET.length} labelled messages (8 languages and currencies, spam, support, prompt injection attempts).`,
  `Models: ${models.analyze} for extraction, ${models.draft} for reply drafts. Run ${new Date().toISOString().slice(0, 10)}.`,
  ``,
  `| Field | Correct | Accuracy |`,
  `| --- | --- | --- |`,
  ...rows.map((r) => `| ${r.field} | ${r.right}/${r.total} | ${r.pct.toFixed(0)}% |`),
  `| drafts passing safety checks | ${cleanDrafts}/${drafts.length} | ${drafts.length ? ((100 * cleanDrafts) / drafts.length).toFixed(0) : 0}% |`,
  ``,
  `Total cost $${cost.toFixed(4)} (≈ $${(cost / DATASET.length).toFixed(4)} per message incl. draft), median ${(p50 / 1000).toFixed(1)} s per message.`,
  ``,
  ...(misses.length
    ? [`## Misses`, ``, `| Message | Field | Expected | Got |`, `| --- | --- | --- | --- |`, ...misses, ``]
    : []),
  ...(errors.length ? [`## Errors`, ``, ...errors.map((r) => `- ${r.c.id}: ${r.error}`), ``] : []),
  ...drafts
    .filter((r) => r.draftWarnings!.length)
    .map((r) => `- Draft warnings for ${r.c.id}: ${r.draftWarnings!.join('; ')}`),
].join('\n');

writeFileSync(new URL('./results.md', import.meta.url), report + '\n');
console.log(report);
