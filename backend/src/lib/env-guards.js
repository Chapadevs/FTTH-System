/**
 * Ensures production never runs with dev-only mock-login flags.
 * Call after `load-env.js` (dotenv) has run.
 */
export function assertProdEnvSeparatesDevMock() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }
  if (process.env.ALLOW_DEV_AUTH_MOCK === "true") {
    throw new Error(
      'Refusing to start: ALLOW_DEV_AUTH_MOCK must not be "true" when NODE_ENV is production.'
    );
  }
}
