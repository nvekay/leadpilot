import { leads } from '../src/db/schema.js';
import { DemoSeeder } from '../src/maintenance/demo-seeder.js';
import { MaintenanceService } from '../src/maintenance/maintenance.module.js';
import { createTestApp, type TestApp } from './app.js';

let t: TestApp;
beforeAll(async () => {
  t = await createTestApp();
});
afterAll(async () => {
  await t.app.close();
});
beforeEach(async () => {
  await t.reset();
});

it('removes visitors’ old demo leads and keeps seeded examples and real email', async () => {
  const old = new Date(Date.now() - 4 * 24 * 3600_000);
  const base = { fromEmail: 'a@b.example', body: 'hello there, we need an app', status: 'ignored' as const };
  await t.db.insert(leads).values([
    { ...base, source: 'demo', externalId: 'saas-dashboard-1', receivedAt: old },
    { ...base, source: 'form', externalId: 'form-1', receivedAt: old },
    { ...base, source: 'demo', externalId: 'seed-saas-dashboard', receivedAt: old },
    { ...base, source: 'email', externalId: '<m1@mail.example>', receivedAt: old },
    { ...base, source: 'demo', externalId: 'spam-2', receivedAt: new Date() },
  ]);

  const removed = await t.app.get(MaintenanceService).cleanupDemoLeads();

  expect(removed).toBe(2);
  const left = await t.db.select({ externalId: leads.externalId }).from(leads);
  expect(left.map((l) => l.externalId).sort()).toEqual(['<m1@mail.example>', 'seed-saas-dashboard', 'spam-2']);
});

it('seeds the sample emails once, however many times the app starts', async () => {
  const seeder = t.app.get(DemoSeeder);
  expect(await seeder.seed()).toBe(8);
  expect(await seeder.seed()).toBe(0);
  const rows = await t.db.select({ externalId: leads.externalId }).from(leads);
  expect(rows).toHaveLength(8);
  expect(rows.every((r) => r.externalId.startsWith('seed-'))).toBe(true);
  // Seeded examples survive the cleanup
  expect(await t.app.get(MaintenanceService).cleanupDemoLeads(new Date(Date.now() + 30 * 24 * 3600_000))).toBe(0);
});
