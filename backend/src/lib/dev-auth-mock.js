import { prisma } from "./prisma.js";
import { publicUserSelect } from "./public-user.js";

/** Stable id so imports using ctx.user.id satisfy FK to User. */
export const MOCK_DEV_ADMIN_USER_ID = "cldevmockadminfiberops01";

const MOCK_FIREBASE_UID = "dev-mock-firebase-admin";
const MOCK_EMAIL = "dev-mock-admin@fiberops.local";
const MOCK_USERNAME = "dev-admin";
const MOCK_NAME = "Local Dev Admin";

/**
 * Dev-only mock login. Production always returns false; local dev also requires
 * ALLOW_DEV_AUTH_MOCK=true (set by npm run dev).
 */
export function isDevelopmentAuthMock() {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  return (
    process.env.NODE_ENV === "development" && process.env.ALLOW_DEV_AUTH_MOCK === "true"
  );
}

/** Same shape as DB row when offline (imports need a real row when DB is up). */
export function getDevMockAdminUserSnapshot() {
  return {
    id: MOCK_DEV_ADMIN_USER_ID,
    username: MOCK_USERNAME,
    email: MOCK_EMAIL,
    name: MOCK_NAME,
    role: "ADMIN",
    createdAt: new Date("2020-01-01T00:00:00.000Z"),
  };
}

/**
 * Prefer upsert against the DB. If Prisma cannot connect, still return a profile so dev login works.
 */
export async function resolveDevMockAdminUser() {
  try {
    return await ensureDevMockAdminUser();
  } catch (err) {
    console.warn(
      "[dev-auth] Database unreachable — mock login uses offline user. Point DATABASE_URL at local Docker Postgres for full features.",
      err?.message || err
    );
    return getDevMockAdminUserSnapshot();
  }
}

/** Ensures the dev mock admin row exists (call on login and when resolving the mock JWT). */
export async function ensureDevMockAdminUser() {
  return prisma.user.upsert({
    where: { id: MOCK_DEV_ADMIN_USER_ID },
    create: {
      id: MOCK_DEV_ADMIN_USER_ID,
      firebaseUid: MOCK_FIREBASE_UID,
      username: MOCK_USERNAME,
      email: MOCK_EMAIL,
      name: MOCK_NAME,
      role: "ADMIN",
    },
    update: {
      username: MOCK_USERNAME,
      email: MOCK_EMAIL,
      name: MOCK_NAME,
      role: "ADMIN",
      firebaseUid: MOCK_FIREBASE_UID,
    },
    select: publicUserSelect,
  });
}
