import type { Icp, LeadAnalysis, ScoreReason } from './lead.js';

const formatUsd = (n: number) => `$${n.toLocaleString('en-US')}`;

/**
 * Scores a lead from 0 to 100 against the ideal customer profile. Plain rules, not the model, so every point has a
 * reason a sales rep can read and the same lead always gets the same score.
 */
export function scoreLead(a: LeadAnalysis, icp: Icp): { score: number; reasons: ScoreReason[] } {
  if (a.category !== 'sales_lead')
    return { score: 0, reasons: [{ points: 0, reason: `Not a sales lead (${a.category})` }] };

  const reasons: ScoreReason[] = [{ points: 30, reason: 'Asks for a quote or project' }];

  const budget = a.budgetUsd?.max ?? a.budgetUsd?.min ?? null;
  if (budget === null) reasons.push({ points: 0, reason: 'Budget not stated' });
  else if (budget >= icp.minBudgetUsd) reasons.push({ points: 25, reason: `Budget ${formatUsd(budget)} fits` });
  else reasons.push({ points: -10, reason: `Budget ${formatUsd(budget)} is below ${formatUsd(icp.minBudgetUsd)}` });

  const wanted = a.services.map((s) => s.toLowerCase());
  const match = icp.services.find((s) =>
    wanted.some((w) => w.includes(s.toLowerCase()) || s.toLowerCase().includes(w)),
  );
  if (match) reasons.push({ points: 20, reason: `Needs a service we offer: ${match}` });
  else if (wanted.length) reasons.push({ points: 0, reason: 'Services asked for are not in our list' });

  const country = a.company.country?.toUpperCase() ?? null;
  if (country && icp.targetCountries.includes(country))
    reasons.push({ points: 10, reason: `Target market (${country})` });
  else if (country) reasons.push({ points: -5, reason: `Outside target markets (${country})` });

  if (a.company.employees !== null && a.company.employees >= icp.minEmployees)
    reasons.push({ points: 10, reason: `Company size ${a.company.employees}+` });

  if (a.company.name || a.company.website) reasons.push({ points: 5, reason: 'Company identified' });
  if (a.urgency === 'high') reasons.push({ points: 5, reason: 'Urgent' });
  if (a.suspiciousInstructions) reasons.push({ points: -30, reason: 'Contains instructions aimed at an AI system' });

  const total = reasons.reduce((sum, r) => sum + r.points, 0);
  return { score: Math.max(0, Math.min(100, total)), reasons };
}
