import { prisma } from "./prisma.js";
import { verifyBearerToken } from "./auth-tokens.js";
import { publicUserSelect } from "./public-user.js";
import {
  ensureDevMockAdminUser,
  getDevMockAdminUserSnapshot,
  isDevelopmentAuthMock,
  MOCK_DEV_ADMIN_USER_ID,
} from "./dev-auth-mock.js";

export async function getRequestUser(req) {
  const userId = await verifyBearerToken(req);
  if (!userId) {
    return null;
  }

  if (isDevelopmentAuthMock() && userId === MOCK_DEV_ADMIN_USER_ID) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: publicUserSelect,
      });
      if (user) {
        return user;
      }
      return await ensureDevMockAdminUser();
    } catch {
      return getDevMockAdminUserSnapshot();
    }
  }

  return prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });
}
