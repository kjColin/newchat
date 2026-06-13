const DEFAULT_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:3001',
  'https://newchat.clnkj.de',
];

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret) return secret;

  if (isProduction()) {
    throw new Error('JWT_SECRET is required in production');
  }

  return 'dev-secret-change-me';
}

export function getDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) return url;
  if (isProduction()) return requireEnv('DATABASE_URL');
  return undefined;
}

function getPositiveIntegerEnv(name: string, defaultValue: number) {
  const raw = process.env[name];
  if (!raw) return defaultValue;

  if (!/^[1-9]\d*$/.test(raw)) {
    throw new Error(`${name} must be a positive integer`);
  }

  return Number.parseInt(raw, 10);
}

export function getNotificationRetentionDays() {
  return getPositiveIntegerEnv('NOTIFICATION_RETENTION_DAYS', 30);
}

export function getNotificationMaxPerUser() {
  return getPositiveIntegerEnv('NOTIFICATION_MAX_PER_USER', 100);
}

export function getNotificationCleanupIntervalMs() {
  const minutes = getPositiveIntegerEnv('NOTIFICATION_CLEANUP_INTERVAL_MINUTES', 60);
  return minutes * 60 * 1000;
}

export function getPresenceOfflineDelayMs() {
  return getPositiveIntegerEnv('PRESENCE_OFFLINE_DELAY_MS', 15000);
}

export function getHost() {
  return process.env.HOST?.trim() || '127.0.0.1';
}

export function getPort() {
  return getPositiveIntegerEnv('PORT', 3000);
}

export function getCorsOrigins() {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) {
    if (isProduction()) throw new Error('CORS_ORIGINS is required in production');
    return DEFAULT_CORS_ORIGINS;
  }

  const origins = raw.split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must include at least one origin');
  }

  return origins;
}

export function validateRuntimeConfig() {
  getDatabaseUrl();
  getJwtSecret();
  getPort();
  getCorsOrigins();
  getNotificationRetentionDays();
  getNotificationMaxPerUser();
  getNotificationCleanupIntervalMs();
  getPresenceOfflineDelayMs();
}
