import { initTRPC, TRPCError } from "@trpc/server";
import { getRequestUser } from "./lib/request-user.js";

export async function createContext(opts) {
  const user = await getRequestUser(opts.req);
  return { user };
}

const t = initTRPC.context().create({
  errorFormatter({ shape }) {
    return shape;
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async (opts) => {
  if (!opts.ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required. Sign in to continue.",
    });
  }
  return opts.next({ ctx: { ...opts.ctx, user: opts.ctx.user } });
});
