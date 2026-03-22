import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "../trpc.js";
import { getSignedUploadUrl } from "../services/gcs.js";
import { useLocalImportStorage } from "../services/local-import-storage.js";

export const uploadsRouter = router({
  /** True when imports use disk + POST /api/uploads/local-import (default in non-production). */
  localImportEnabled: publicProcedure.query(() => useLocalImportStorage()),

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
