import { router, protectedProcedure } from "../trpc.js";

export const usersRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user;
  }),
});
