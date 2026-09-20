import { useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GuestPrompt } from "@/components/auth/guest-prompt";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { listBookingMessages, markNotificationsRead, sendBookingMessage } from "@/lib/server/queries";

export const Route = createFileRoute("/inbox/$bookingId")({ component: ThreadPage });

function ThreadPage() {
  const { user, isPending } = useCurrentUserState();
  const { bookingId } = Route.useParams();
  if (isPending) return <p className="text-sm text-muted">Opening chat…</p>;
  if (!user) {
    return (
      <GuestPrompt
        title="Messages"
        blurb="Log in to send and read messages."
        next={`/inbox/${bookingId}`}
      />
    );
  }
  return <Thread userId={user.id} bookingId={bookingId} />;
}

function Thread({ userId, bookingId }: { userId: string; bookingId: string }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const scroller = useRef<HTMLDivElement>(null);
  const msgs = useQuery({
    queryKey: ["thread", bookingId],
    queryFn: () => listBookingMessages({ data: bookingId }),
    enabled: !!userId,
    refetchInterval: 3000,
  });
  const send = useMutation({
    mutationFn: (text: string) => sendBookingMessage({ data: { bookingId, body: text } }),
    onSuccess: async () => {
      setBody("");
      await qc.invalidateQueries({ queryKey: ["thread", bookingId] });
      await qc.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (e: Error) => toast.error(e.message || "Could not send."),
  });

  useEffect(() => {
    void markNotificationsRead().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }));
  }, [bookingId, qc]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.data]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = body.trim();
    if (!text || send.isPending) return;
    send.mutate(text);
  }

  return (
    <div className="thread-page flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 pb-2">
        <Link to="/inbox" className="text-sm text-muted">
          ← Inbox
        </Link>
        <h1 className="font-display text-3xl tracking-wide">Messages</h1>
      </div>
      <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto py-2">
        {msgs.isError && <p className="text-sm text-danger">Couldn’t load this chat.</p>}
        {(msgs.data ?? []).map((m) => {
          const mine = m.sender_user_id === userId;
          const when = m.created_at
            ? new Date(m.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
            : "";
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  mine
                    ? "max-w-[80%] rounded-2xl bg-cta px-3 py-2 text-sm text-cta-fg"
                    : "max-w-[80%] rounded-2xl bg-elevated px-3 py-2 text-sm"
                }
              >
                <p>{m.body}</p>
                {when ? <p className={`mt-1 text-[10px] ${mine ? "text-cta-fg/70" : "text-subtle"}`}>{when}</p> : null}
              </div>
            </div>
          );
        })}
        {!msgs.isLoading && (msgs.data ?? []).length === 0 && (
          <p className="text-sm text-muted">Say hi. Keep it about the session.</p>
        )}
      </div>
      <form
        className="sticky bottom-0 flex shrink-0 gap-2 bg-bg pt-2"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
        onSubmit={onSubmit}
      >
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          autoComplete="off"
          enterKeyHint="send"
        />
        <Button type="submit" variant="cta" disabled={send.isPending || !body.trim()}>
          {send.isPending ? "…" : "Send"}
        </Button>
      </form>
    </div>
  );
}
