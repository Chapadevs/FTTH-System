import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";

export const equipmentRouter = router({
  byProject: protectedProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return prisma.equipment.findMany({
        where: { projectId: input.projectId },
        include: { pole: true, project: { select: { name: true } } },
      });
    }),

  list: protectedProcedure.query(async () => {
    return prisma.equipment.findMany({
      include: { pole: true, project: { select: { name: true, id: true } } },
      orderBy: { tag: "asc" },
    });
  }),
});
