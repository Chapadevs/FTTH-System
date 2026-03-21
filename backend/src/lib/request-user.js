import { prisma } from "./prisma.js";

const ADMIN_EMAIL = "admin@fiberops.com";

export async function getRequestUser(req) {
  const email = req.headers["x-user-email"];
  if (email && typeof email === "string") {
    const user = await prisma.user.findUnique({
      where: { email },
    });
    if (user) return user;
  }
  const admin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });
  if (admin) return admin;
  return prisma.user.findFirst();
}
