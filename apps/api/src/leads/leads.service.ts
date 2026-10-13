import type { LeadSource, LeadStatus } from '@leadpilot/shared';
import { Injectable } from '@nestjs/common';
import { and, desc, eq, inArray, lt, sql } from 'drizzle-orm';
import { type Db, InjectDb } from '../db/db.module.js';
import { type Lead, leadEvents, leads } from '../db/schema.js';

export interface NewInboundLead {
  source: LeadSource;
  externalId: string;
  fromEmail: string;
  fromName: string | null;
  subject: string | null;
  body: string;
}

export interface EventInput {
  type: string;
  actor: 'system' | 'user' | 'llm' | 'crm' | 'mail' | 'slack';
  data?: Record<string, unknown>;
  costUsd?: number;
  durationMs?: number;
}

@Injectable()
export class LeadsService {
  constructor(@InjectDb() private readonly db: Db) {}

  /**
   * Stores an inbound message once. The same email or form submission delivered again (webhook retries,
   * double clicks) returns the existing lead with `duplicate: true` and creates nothing new.
   */
  async ingest(input: NewInboundLead): Promise<{ lead: Lead; duplicate: boolean }> {
    const [created] = await this.db
      .insert(leads)
      .values({ ...input, fromEmail: input.fromEmail.trim().toLowerCase() })
      .onConflictDoNothing({ target: [leads.source, leads.externalId] })
      .returning();
    if (created) {
      await this.event(created.id, { type: 'received', actor: 'system', data: { source: input.source } });
      return { lead: created, duplicate: false };
    }
    const [existing] = await this.db
      .select()
      .from(leads)
      .where(and(eq(leads.source, input.source), eq(leads.externalId, input.externalId)));
    return { lead: existing!, duplicate: true };
  }

  async get(id: string): Promise<Lead | undefined> {
    const [lead] = await this.db.select().from(leads).where(eq(leads.id, id));
    return lead;
  }

  async list(opts: { status?: LeadStatus[]; before?: Date; limit?: number } = {}) {
    return this.db
      .select()
      .from(leads)
      .where(
        and(
          opts.status?.length ? inArray(leads.status, opts.status) : undefined,
          opts.before ? lt(leads.receivedAt, opts.before) : undefined,
        ),
      )
      .orderBy(desc(leads.receivedAt))
      .limit(opts.limit ?? 50);
  }

  async events(leadId: string) {
    return this.db.select().from(leadEvents).where(eq(leadEvents.leadId, leadId)).orderBy(leadEvents.createdAt);
  }

  /** Counts per status for the inbox tabs */
  async counts(): Promise<Partial<Record<LeadStatus, number>>> {
    const rows = await this.db
      .select({ status: leads.status, n: sql<number>`count(*)::int` })
      .from(leads)
      .groupBy(leads.status);
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  }

  /**
   * Moves a lead from one status to the next and applies `patch` in the same statement. Returns null when the
   * lead is no longer in `from` (another worker or a person got there first), so each step runs at most once.
   */
  async transition(
    id: string,
    from: LeadStatus | LeadStatus[],
    to: LeadStatus,
    patch: Partial<Lead> = {},
  ): Promise<Lead | null> {
    const [lead] = await this.db
      .update(leads)
      .set({ ...patch, status: to })
      .where(and(eq(leads.id, id), inArray(leads.status, Array.isArray(from) ? from : [from])))
      .returning();
    return lead ?? null;
  }

  async update(id: string, patch: Partial<Lead>) {
    const [lead] = await this.db.update(leads).set(patch).where(eq(leads.id, id)).returning();
    return lead;
  }

  async event(leadId: string, e: EventInput) {
    await this.db.insert(leadEvents).values({
      leadId,
      type: e.type,
      actor: e.actor,
      data: e.data,
      costUsd: e.costUsd === undefined ? undefined : e.costUsd.toFixed(6),
      durationMs: e.durationMs,
    });
  }
}
