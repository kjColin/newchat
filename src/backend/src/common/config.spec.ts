import {
  getCorsOrigins,
  getJwtSecret,
  getNotificationRetentionDays,
  getPresenceOfflineDelayMs,
  getPort,
  validateRuntimeConfig,
} from './config';

describe('runtime config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.NODE_ENV;
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.CORS_ORIGINS;
    delete process.env.PORT;
    delete process.env.NOTIFICATION_RETENTION_DAYS;
    delete process.env.PRESENCE_OFFLINE_DELAY_MS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses development defaults for local startup', () => {
    expect(getJwtSecret()).toBe('dev-secret-change-me');
    expect(getCorsOrigins()).toContain('http://localhost:5173');
    expect(getPort()).toBe(3000);
    expect(getPresenceOfflineDelayMs()).toBe(15000);
  });

  it('requires production secrets and CORS origins', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';

    expect(() => validateRuntimeConfig()).toThrow('JWT_SECRET is required in production');

    process.env.JWT_SECRET = 'prod-secret';
    expect(() => validateRuntimeConfig()).toThrow('CORS_ORIGINS is required in production');
  });

  it('parses configured production values', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'prod-secret';
    process.env.CORS_ORIGINS = 'https://app.example.com, https://admin.example.com';
    process.env.PORT = '3101';
    process.env.NOTIFICATION_RETENTION_DAYS = '14';
    process.env.PRESENCE_OFFLINE_DELAY_MS = '250';

    expect(validateRuntimeConfig()).toBeUndefined();
    expect(getCorsOrigins()).toEqual(['https://app.example.com', 'https://admin.example.com']);
    expect(getPort()).toBe(3101);
    expect(getNotificationRetentionDays()).toBe(14);
    expect(getPresenceOfflineDelayMs()).toBe(250);
  });

  it('rejects non-integer numeric environment values', () => {
    process.env.NOTIFICATION_RETENTION_DAYS = '30days';

    expect(() => getNotificationRetentionDays()).toThrow('NOTIFICATION_RETENTION_DAYS must be a positive integer');
  });
});
