import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";

export const mapRouter = router({
  getData: publicProcedure
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
          include: { equipment: true },
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

      return { poles, equipment, segments };
    }),
});
