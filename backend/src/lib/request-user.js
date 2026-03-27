import { prisma } from "./prisma.js";
import { verifyBearerToken } from "./auth-tokens.js";
import { publicUserSelect } from "./public-user.js";

export async function getRequestUser(req) {
  const userId = await verifyBearerToken(req);
  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
}
