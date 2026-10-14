import { pgConfig } from './pg-config.js';

describe('pgConfig', () => {
  it('turns TLS on for a hosted database whose URL lost its sslmode', () => {
    expect(pgConfig('postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb').ssl).toBe(true);
  });

  it('leaves an explicit sslmode to the URL', () => {
    expect(
      pgConfig('postgresql://u:p@ep-cool-1.eu-central-1.aws.neon.tech/neondb?sslmode=require').ssl,
    ).toBeUndefined();
  });

  it('connects to local Postgres without TLS', () => {
    expect(pgConfig('postgres://leadpilot:leadpilot@localhost:5433/leadpilot').ssl).toBeUndefined();
  });
});
