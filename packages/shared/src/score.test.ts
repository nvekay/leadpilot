import { describe, expect, it } from 'vitest';
import type { Icp, LeadAnalysis } from './lead.js';
import { scoreLead } from './score.js';

const icp: Icp = {
  minBudgetUsd: 5000,
  targetCountries: ['US', 'GB', 'DE'],
  services: ['Web app', 'Mobile app', 'AI integration'],
  minEmployees: 10,
  hotScore: 70,
};

const lead = (overrides: Partial<LeadAnalysis> = {}): LeadAnalysis => ({
  category: 'sales_lead',
  summary: 'Wants a web app',
  contact: { name: 'Ann Lee', email: 'ann@acme.com', phone: null, jobTitle: 'CTO' },
  company: { name: 'Acme', website: 'acme.com', country: 'US', employees: 40 },
  services: ['web app for bookings'],
  budgetUsd: { min: 10000, max: 20000 },
  timeline: 'Q1',
  urgency: 'normal',
  language: 'en',
  suspiciousInstructions: false,
  ...overrides,
});

describe('scoreLead', () => {
  it('gives a strong lead a high score with a reason for every point', () => {
    const { score, reasons } = scoreLead(lead(), icp);
    expect(score).toBe(100);
    expect(reasons.map((r) => r.reason)).toEqual([
      'Asks for a quote or project',
      'Budget $20,000 fits',
      'Needs a service we offer: Web app',
      'Target market (US)',
      'Company size 40+',
      'Company identified',
    ]);
  });

  it('scores anything that is not a sales lead as zero', () => {
    expect(scoreLead(lead({ category: 'spam' }), icp)).toEqual({
      score: 0,
      reasons: [{ points: 0, reason: 'Not a sales lead (spam)' }],
    });
  });

  it('penalises a small budget and markets outside the profile', () => {
    const { score, reasons } = scoreLead(
      lead({
        budgetUsd: { min: null, max: 800 },
        company: { name: null, website: null, country: 'IN', employees: null },
      }),
      icp,
    );
    expect(reasons).toContainEqual({ points: -10, reason: 'Budget $800 is below $5,000' });
    expect(reasons).toContainEqual({ points: -5, reason: 'Outside target markets (IN)' });
    expect(score).toBe(35);
  });

  it('does not guess when the budget is unknown', () => {
    const { reasons } = scoreLead(lead({ budgetUsd: null }), icp);
    expect(reasons).toContainEqual({ points: 0, reason: 'Budget not stated' });
  });

  it('pushes down messages that try to instruct the model', () => {
    const normal = scoreLead(lead(), icp).score;
    const injected = scoreLead(lead({ suspiciousInstructions: true }), icp);
    expect(injected.score).toBe(normal - 30);
    expect(injected.reasons.at(-1)?.reason).toBe('Contains instructions aimed at an AI system');
  });

  it('never goes below zero', () => {
    const { score } = scoreLead(
      lead({
        budgetUsd: { min: 100, max: 100 },
        services: ['logo design'],
        company: { name: null, website: null, country: 'BR', employees: 2 },
        suspiciousInstructions: true,
      }),
      icp,
    );
    expect(score).toBe(0);
  });
});
