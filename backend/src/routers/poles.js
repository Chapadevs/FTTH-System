import { z } from "zod";
import { router, publicProcedure } from "../trpc.js";
import { prisma } from "../lib/prisma.js";

export const polesRouter = router({
  byProject: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ input }) => {
      return prisma.pole.findMany({
        where: { projectId: input.projectId },
        include: { equipment: true },
      });
    }),
});
