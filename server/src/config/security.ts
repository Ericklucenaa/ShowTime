const isProduction = process.env.NODE_ENV === 'production';

const DEV_FALLBACK_JWT_SECRET = 'dev-only-insecure-jwt-secret-change-me-1234567890';
const MIN_JWT_SECRET_LENGTH = 32;

let warnedAboutDevSecret = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (secret && secret.length >= MIN_JWT_SECRET_LENGTH) {
    return secret;
  }

  if (isProduction) {
    throw new Error(
      `JWT_SECRET must be set with at least ${MIN_JWT_SECRET_LENGTH} characters in production.`
    );
  }

  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true;
    console.warn(
      '[security] Using development fallback JWT secret. Set JWT_SECRET for safer local environments.'
    );
  }

  return secret || DEV_FALLBACK_JWT_SECRET;
}

export function getJwtIssuer(): string {
  return process.env.JWT_ISSUER?.trim() || 'epsync-api';
}

export function getJwtAudience(): string {
  return process.env.JWT_AUDIENCE?.trim() || 'epsync-client';
}

export function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured && configured.length > 0) {
    return configured;
  }

  if (isProduction) {
    return [];
  }

  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173'
  ];
}

export function isProdEnv(): boolean {
  return isProduction;
}
