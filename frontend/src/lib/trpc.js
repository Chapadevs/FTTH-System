import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "http://localhost:3000");
const trpcUrl = `${apiUrl}/trpc`;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60 * 1000 },
  },
});

export const trpcClient = createTRPCClient({
  links: [
    httpBatchLink({
      url: trpcUrl,
      headers() {
        const email = localStorage.getItem("fiberops-user-email");
        return email ? { "x-user-email": email } : {};
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy({
  client: trpcClient,
  queryClient,
});
