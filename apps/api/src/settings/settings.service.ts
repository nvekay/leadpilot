import { type Icp, icpSchema } from '@leadpilot/shared';
import { Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { type Db, InjectDb } from '../db/db.module.js';
import { settings } from '../db/schema.js';

export interface WorkspaceSettings {
  icp: Icp;
  replySignature: string;
  calendarUrl: string;
}

/** The demo agency: builds web and mobile apps and AI integrations for small and mid-size companies */
export const DEFAULT_SETTINGS: WorkspaceSettings = {
  icp: {
    minBudgetUsd: 5000,
    targetCountries: ['US', 'CA', 'GB', 'DE', 'NL', 'AU'],
    services: ['Web app', 'Mobile app', 'AI integration', 'E-commerce', 'Dashboard'],
    minEmployees: 10,
    hotScore: 70,
  },
  replySignature: 'Sam Carter\nNorthwind Studio',
  calendarUrl: 'https://cal.com/northwind-studio/intro',
};

@Injectable()
export class SettingsService {
  constructor(@InjectDb() private readonly db: Db) {}

  async get(): Promise<WorkspaceSettings> {
    const [row] = await this.db.select().from(settings).where(eq(settings.id, 1));
    if (!row) return DEFAULT_SETTINGS;
    return { icp: row.icp, replySignature: row.replySignature, calendarUrl: row.calendarUrl };
  }

  async update(next: WorkspaceSettings): Promise<WorkspaceSettings> {
    const icp = icpSchema.parse(next.icp);
    const values = { id: 1, icp, replySignature: next.replySignature, calendarUrl: next.calendarUrl };
    await this.db
      .insert(settings)
      .values(values)
      .onConflictDoUpdate({ target: settings.id, set: { ...values, updatedAt: new Date() } });
    return this.get();
  }
}
