import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GROK_PROVIDERS, authClient, signIn } from "@/lib/auth/client";

function raiseField(el: HTMLElement) {
  window.setTimeout(() => {
    el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
  }, 250);
}

export function SignInPanel({
  next = "/search",
  compact = false,
}: {
  next?: string;
  compact?: boolean;
}) {
  const returnTo = `/login?redirect=${encodeURIComponent(next)}`;
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  async function continueWith(providerId: string) {
    setBusy(true);
    try {
      await signIn(providerId, { callbackURL: next, errorCallbackURL: returnTo });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed. Try email.");
      setBusy(false);
    }
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    const em = email.trim();
    if (!em.includes("@")) {
      toast.error("Enter a real email.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password needs at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        const { error } = await authClient.signUp.email({
          email: em,
          password,
          name: name.trim() || "Client",
        });
        if (error) throw new Error(error.message || "Could not create account.");
      } else {
        const { error } = await authClient.signIn.email({ email: em, password });
        if (error) throw new Error(error.message || "Could not sign in.");
      }
      await authClient.getSession();
      window.location.assign(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
        <div style={{ display: "flex", gap: 8 }}>
          {GROK_PROVIDERS.map((p) => (
            <button
              key={p.providerId}
              type="button"
              disabled={busy}
              onClick={() => void continueWith(p.providerId)}
              style={{
                flex: 1,
                minHeight: 44,
                fontSize: 16,
                fontWeight: 600,
                borderRadius: 999,
                background: "#1a1a1e",
                color: "#f4f4f5",
                border: "1px solid rgba(255,255,255,0.16)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

      <div className="flex items-center gap-3 py-0.5 text-[11px] font-medium uppercase tracking-[0.22em] text-subtle">
        <span className="h-px flex-1 bg-border" />
        Email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="flex flex-col gap-2.5" onSubmit={(e) => void onEmail(e)}>
        {mode === "up" && (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={(e) => raiseField(e.currentTarget)}
            placeholder="Name"
            autoComplete="name"
            className={compact ? "h-11 rounded-full" : "h-12 rounded-full"}
          />
        )}
        <Input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onFocus={(e) => raiseField(e.currentTarget)}
          placeholder="Email"
          autoComplete="email"
          inputMode="email"
          className={compact ? "h-11 rounded-full" : "h-12 rounded-full"}
        />
        <Input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onFocus={(e) => raiseField(e.currentTarget)}
          placeholder="Password"
          autoComplete={mode === "up" ? "new-password" : "current-password"}
          className={compact ? "h-11 rounded-full" : "h-12 rounded-full"}
        />
        <Button
          type="submit"
          variant="cta"
          size="lg"
          className="h-12 w-full text-[15px] tracking-[0.16em]"
          disabled={busy}
        >
          {busy ? "Working…" : mode === "up" ? "CREATE ACCOUNT" : compact ? "SIGN IN" : "CONTINUE"}
        </Button>
      </form>

      <button
        type="button"
        className="py-1 text-center text-sm text-muted"
        onClick={() => setMode(mode === "in" ? "up" : "in")}
      >
        {mode === "in" ? "Need an account? Create one" : "Have an account? Sign in"}
      </button>
    </div>
  );
}
