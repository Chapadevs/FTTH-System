import { PrismaClient } from "../src/generated/prisma/client.js";
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const del = (name, fn) => fn().then((r) => (console.log(`Deleted ${r.count} ${name}`), r));

    await del("FiberAssignment", () => tx.fiberAssignment.deleteMany());
    await del("FiberRecord", () => tx.fiberRecord.deleteMany());
    await del("SheathEndpoint", () => tx.sheathEndpoint.deleteMany());
    await del("Sheath", () => tx.sheath.deleteMany());
    await del("Equipment", () => tx.equipment.deleteMany());
    await del("FiberSegment", () => tx.fiberSegment.deleteMany());
    await del("Pole", () => tx.pole.deleteMany());
    await del("Project", () => tx.project.deleteMany());
  });

  console.log("All project data cleared.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
