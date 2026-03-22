import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";
import { buildPoleDetail } from "../services/pole-detail.js";
import { ensurePoleStreetName } from "../services/reverse-geocode.js";

export const polesRouter = router({
  byProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return prisma.pole.findMany({
        where: { projectId: input.projectId },
        include: { equipment: true },
      });
    }),

  getDetail: publicProcedure
    .input(z.object({ poleId: z.string() }))
    .query(async ({ input }) => {
      const pole = await prisma.pole.findUnique({
        where: { id: input.poleId },
        include: {
          equipment: true,
          segmentsFrom: {
            include: {
              toPole: {
                select: {
                  id: true,
                  poleNumber: true,
                  lat: true,
                  lng: true,
                  streetName: true,
                  status: true,
                },
              },
            },
          },
          segmentsTo: {
            include: {
              fromPole: {
                select: {
                  id: true,
                  poleNumber: true,
                  lat: true,
                  lng: true,
                  streetName: true,
                  status: true,
                },
              },
            },
          },
          sheathEndpoints: {
            include: {
              sheath: {
                include: {
                  endpoints: {
                    include: {
                      pole: {
                        select: {
                          id: true,
                          poleNumber: true,
                          streetName: true,
                          lat: true,
                          lng: true,
                        },
                      },
                    },
                  },
                  fiberRecords: {
                    include: {
                      assignments: {
                        include: {
                          equipment: {
                            select: {
                              id: true,
                              tag: true,
                              name: true,
                              equipType: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!pole) {
        throw new Error("Pole not found");
      }

      if (!pole.streetName) {
        const streetName = await ensurePoleStreetName(prisma, pole);
        if (streetName) {
          pole.streetName = streetName;
        }
      }

      return buildPoleDetail(pole);
    }),
});
