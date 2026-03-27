import { SignJWT, jwtVerify } from "jose";

const textEncoder = new TextEncoder();
const jwtSecret = process.env.JWT_SECRET;
const jwtExpiresIn = process.env.JWT_EXPIRES_IN || "7d";

if (process.env.NODE_ENV === "production" && !jwtSecret) {
  throw new Error("JWT_SECRET must be set in production.");
}

function getJwtSecret() {
  const secret = jwtSecret || "local-dev-jwt-secret-change-me";
  return textEncoder.encode(secret);
}

export async function signUserToken(userId) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(jwtExpiresIn)
    .sign(getJwtSecret());
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization;
  if (!authorization || typeof authorization !== "string") {
    return null;
  }

  const [scheme, token] = authorization.split(" ");
  if (scheme !== "Bearer" || !token) {
    return null;
  }

  return token;
}

export async function verifyBearerToken(req) {
  const token = getBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
