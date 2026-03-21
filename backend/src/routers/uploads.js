import { z } from "zod";
import { router, protectedProcedure } from "../trpc.js";
import { getSignedUploadUrl } from "../services/gcs.js";

export const uploadsRouter = router({
  getSignedUrl: protectedProcedure
    .input(
      z.object({
        fileName: z.string(),
        contentType: z.string().default("application/zip"),
      })
    )
    .mutation(async ({ input }) => {
      const { url, filePath } = await getSignedUploadUrl(
        input.fileName,
        input.contentType
      );
      return { url, filePath };
    }),
});
