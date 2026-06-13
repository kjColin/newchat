export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET is required in production');
  }

  return 'dev-secret-change-me';
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
