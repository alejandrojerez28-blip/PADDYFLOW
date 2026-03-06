/**
 * Fail-fast: validate auth-critical env before loading any routes.
 * Server must not start without JWT_SECRET in production.
 * In development, use insecure default so Replit can inject vars after boot.
 */
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('FATAL: JWT_SECRET must be set.');
    process.exit(1);
  } else {
    console.warn('WARNING: JWT_SECRET not set. Using insecure default for development only.');
    process.env.JWT_SECRET = 'dev-only-insecure-key-do-not-use-in-prod';
  }
}
