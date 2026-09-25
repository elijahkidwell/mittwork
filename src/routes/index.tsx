import { useLayoutEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/brand";
import { LandingSpin } from "@/components/landing-spin";
import { SignInPanel } from "@/components/auth/sign-in-panel";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/")({
  // Only the landing page shows the chrome spin, so only it preloads those frames.
  head: () => ({
    links: [
      { rel: "preload", href: "/videos/chrome-mittwork.jpg", as: "image" },
      { rel: "preload", href: "/videos/chrome-spin.webp", as: "image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { user } = useCurrentUserState();

  useLayoutEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  return (
    <main
      style={{
        boxSizing: "border-box",
        width: "100%",
        maxWidth: 430,
        margin: "0 auto",
        padding: "12px 20px 120px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Logo stacked />
      </div>

      <div style={{ margin: "12px 0", overflow: "hidden", borderRadius: 8 }}>
        <LandingSpin />
      </div>

      {user ? (
        <a
          href="/search"
          className="mb-3 inline-flex h-12 w-full items-center justify-center rounded-full bg-cta text-[16px] font-semibold tracking-[0.14em] text-cta-fg"
        >
          CONTINUE · {user.displayName || "Account"}
        </a>
      ) : null}

      <div style={{ marginBottom: 12 }}>
        <SignInPanel next="/search" compact />
      </div>

      <a
        href="/search"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full text-[16px] font-semibold tracking-[0.16em] text-fg shadow-[var(--shadow-border)]"
      >
        BROWSE TRAINERS
        <ArrowRight className="size-4" />
      </a>
    </main>
  );
}
