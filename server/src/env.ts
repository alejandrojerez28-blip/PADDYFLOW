/**
 * Fail-fast: validate auth-critical env before loading any routes.
 * Server must not start without JWT_SECRET.
 */
if (!process.env.JWT_SECRET) {
  console.error(
    'FATAL: JWT_SECRET must be set. Set it in .env or environment. The server cannot start without it.'
  );
  process.exit(1);
}
