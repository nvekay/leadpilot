// Test configuration, applied before the app's modules read it
const base = process.env.TEST_DATABASE_URL ?? 'postgres://leadpilot:leadpilot@localhost:5433/leadpilot_test';
process.env.DATABASE_URL = base;
process.env.REDIS_URL = process.env.TEST_REDIS_URL ?? 'redis://localhost:6380/1';
process.env.API_INTERNAL_KEY = 'test-internal-key-0123456789';
process.env.INBOUND_WEBHOOK_TOKEN = 'test-inbound-token-0123456789';
process.env.PIPELINE_RETRY_DELAY_MS = '10';
process.env.NODE_ENV = 'test';
