import { router } from "../trpc.js";
import { projectsRouter } from "./projects.js";
import { polesRouter } from "./poles.js";
import { equipmentRouter } from "./equipment.js";
import { uploadsRouter } from "./uploads.js";
import { usersRouter } from "./users.js";
import { mapRouter } from "./map.js";
import { fibersRouter } from "./fibers.js";

export const appRouter = router({
  projects: projectsRouter,
  poles: polesRouter,
  equipment: equipmentRouter,
  uploads: uploadsRouter,
  users: usersRouter,
  map: mapRouter,
  fibers: fibersRouter,
});
