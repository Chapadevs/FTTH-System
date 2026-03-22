import "./load-env.js";
import express from "express";
import cors from "cors";
import multer from "multer";
import * as trpcExpress from "@trpc/server/adapters/express";
import { createContext } from "./trpc.js";
import { appRouter } from "./routers/_app.js";
import { getRequestUser } from "./lib/request-user.js";
import { saveLocalImportBuffer, useLocalImportStorage } from "./services/local-import-storage.js";

const app = express();
app.use(cors());
app.use(express.json());

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

app.post("/api/uploads/local-import", importUpload.single("file"), async (req, res) => {
  if (!useLocalImportStorage()) {
    res.status(404).json({ error: "Local import uploads are disabled" });
    return;
  }
  try {
    const user = await getRequestUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!req.file?.buffer) {
      res.status(400).json({ error: "Missing file" });
      return;
    }
    const filePath = await saveLocalImportBuffer(req.file.buffer, req.file.originalname);
    res.json({ filePath });
  } catch (err) {
    res.status(500).json({ error: err?.message || "Upload failed" });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
