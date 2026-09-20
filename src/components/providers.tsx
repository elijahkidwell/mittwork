import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 20_000, retry: 1, refetchOnWindowFocus: false },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      {children}
      <Toaster
        theme="dark"
        position="top-center"
        toastOptions={{
          style: {
            background: "#1c1c20",
            color: "#f4f4f5",
            border: "1px solid rgb(255 255 255 / 0.08)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
