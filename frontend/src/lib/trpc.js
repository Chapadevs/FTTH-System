import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { getAuthToken } from "./auth.js";

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
        const token = getAuthToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
    }),
  ],
});

export const trpc = createTRPCOptionsProxy({
  client: trpcClient,
  queryClient,
});
