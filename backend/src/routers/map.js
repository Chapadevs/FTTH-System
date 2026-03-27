import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";
import { hasRenderableCoordinates } from "../lib/geo.js";
import { buildPoleDetail } from "../services/pole-detail.js";
import { getStreetRoute } from "../services/street-routing.js";

export const mapRouter = router({
  getData: protectedProcedure
    .input(
      z
        .object({ projectIds: z.array(z.string()).optional() })
        .optional()
    )
    .query(async ({ input }) => {
      const projectIds = input?.projectIds;
      const where =
        projectIds && projectIds.length > 0
          ? { projectId: { in: projectIds } }
          : {};

      const [poles, equipment, segments] = await Promise.all([
        prisma.pole.findMany({
          where,
          include: {
            equipment: true,
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
                          },
                        },
                      },
                    },
                    fiberRecords: {
                      include: {
                        endpointObservations: true,
                        assignments: {
                          select: {
                            id: true,
                            deviceName: true,
                            portName: true,
                            status: true,
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        prisma.equipment.findMany({
          where,
          include: { pole: true },
        }),
        prisma.fiberSegment.findMany({
          where,
          include: { fromPole: true, toPole: true },
        }),
      ]);

      return {
        poles: poles
          .filter((pole) => hasRenderableCoordinates(pole.lat, pole.lng))
          .map((pole) => {
          const detail = buildPoleDetail(pole);

          return {
            id: pole.id,
            poleNumber: pole.poleNumber,
            streetName: pole.streetName,
            status: pole.status,
            lat: pole.lat,
            lng: pole.lng,
            projectId: pole.projectId,
            summary: detail.summary,
            work: detail.work,
          };
          }),
        equipment,
        segments: segments.filter(
          (seg) =>
            hasRenderableCoordinates(seg.fromPole.lat, seg.fromPole.lng) &&
            hasRenderableCoordinates(seg.toPole.lat, seg.toPole.lng)
        ),
      };
    }),
  streetRoute: protectedProcedure
    .input(
      z.object({
        poleId: z.string().min(1),
        origin: z.object({
          lat: z.number().finite(),
          lng: z.number().finite(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const pole = await prisma.pole.findUnique({
        where: { id: input.poleId },
        select: {
          id: true,
          poleNumber: true,
          streetName: true,
          lat: true,
          lng: true,
        },
      });

      if (!pole) {
        throw new Error("Pole not found.");
      }

      if (!hasRenderableCoordinates(pole.lat, pole.lng)) {
        throw new Error("The selected pole does not have valid coordinates.");
      }

      const route = await getStreetRoute({
        origin: input.origin,
        destination: {
          lat: Number(pole.lat),
          lng: Number(pole.lng),
        },
      });

      return {
        ...route,
        pole: {
          id: pole.id,
          poleNumber: pole.poleNumber,
          streetName: pole.streetName,
          lat: Number(pole.lat),
          lng: Number(pole.lng),
        },
      };
    }),
});
