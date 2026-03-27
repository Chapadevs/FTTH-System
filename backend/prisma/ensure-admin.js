import bcrypt from "bcrypt";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient();
const ADMIN_USERNAME = "paudeinox";
const ADMIN_EMAIL = "paudeinox@fiberops.internal";
const ADMIN_NAME = "Admin";
const ADMIN_FIREBASE_UID = "local-auth-paudeinox";

async function main() {
  const password = process.env.ADMIN_INITIAL_PASSWORD;

  if (!password) {
    throw new Error("ADMIN_INITIAL_PASSWORD is required.");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { username: ADMIN_USERNAME },
    update: {
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "ADMIN",
      firebaseUid: ADMIN_FIREBASE_UID,
      passwordHash,
    },
    create: {
      username: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "ADMIN",
      firebaseUid: ADMIN_FIREBASE_UID,
      passwordHash,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
    },
  });

  console.log(`Admin user ensured: ${user.username} (${user.role})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
