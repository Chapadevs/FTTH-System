import { PrismaClient } from "../src/generated/prisma/client.js";
const prisma = new PrismaClient();

async function main() {
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { firebaseUid: "seed-admin" },
      update: {},
      create: {
        firebaseUid: "seed-admin",
        email: "admin@fiberops.com",
        name: "Admin",
        role: "ADMIN",
      },
    });

    const project = await tx.project.create({
      data: {
        prismId: "3989801",
        name: "McArthur OH — Node 2307E",
        node: "2307E",
        instance: "TWCOLU",
        status: "ACTIVE",
        totalPassings: 225,
        createdById: user.id,
      },
    });

    const p1 = await tx.pole.create({
      data: {
        poleNumber: "15947",
        lat: 39.246,
        lng: -82.478,
        streetName: "Howard Road",
        projectId: project.id,
      },
    });
    const p2 = await tx.pole.create({
      data: {
        poleNumber: "15901",
        lat: 39.2475,
        lng: -82.4762,
        streetName: "Howard Road",
        projectId: project.id,
      },
    });
    const p3 = await tx.pole.create({
      data: {
        poleNumber: "15890",
        lat: 39.249,
        lng: -82.4744,
        streetName: "Millfield Road",
        projectId: project.id,
      },
    });
    const p4 = await tx.pole.create({
      data: {
        poleNumber: "15900",
        lat: 39.2455,
        lng: -82.4755,
        streetName: "Swett Hollow Road",
        projectId: project.id,
      },
    });
    const p5 = await tx.pole.create({
      data: {
        poleNumber: "15889",
        lat: 39.2468,
        lng: -82.473,
        streetName: "Swett Hollow Road",
        projectId: project.id,
      },
    });

    await tx.fiberSegment.createMany({
      data: [
        { lengthFt: 374, projectId: project.id, fromPoleId: p1.id, toPoleId: p2.id },
        { lengthFt: 188, projectId: project.id, fromPoleId: p2.id, toPoleId: p3.id },
        { lengthFt: 197, projectId: project.id, fromPoleId: p1.id, toPoleId: p4.id },
        { lengthFt: 283, projectId: project.id, fromPoleId: p4.id, toPoleId: p5.id },
      ],
    });

    await tx.equipment.createMany({
      data: [
        {
          tag: "FE1",
          name: "2307E_SE_001",
          manufacturer: "COMMSCOPE",
          model: "FTTX_CO_450B66_SPL_SPLIT",
          equipType: "SPLITTER",
          poleId: p1.id,
          projectId: project.id,
        },
        {
          tag: "FE2",
          name: "2307E_SE_002",
          manufacturer: "COMMSCOPE",
          model: "FTTX_CO_450B66_SPL_DIST",
          equipType: "SPLITTER",
          poleId: p2.id,
          projectId: project.id,
        },
        {
          tag: "FT1",
          name: "2307E_FT_001",
          manufacturer: "COMMSCOPE",
          model: "FTTX_CO_A_08_OTE",
          equipType: "TERMINATION",
          portCount: 8,
          poleId: p3.id,
          projectId: project.id,
        },
      ],
    });
  });
}

main()
  .then(() => {
    console.log("Seed completed.");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
