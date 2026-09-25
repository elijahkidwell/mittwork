import { useEffect, useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, Mail, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Skeleton } from "@/components/ui/skeleton";
import { GuestPrompt } from "@/components/auth/guest-prompt";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { addToDeviceCalendar } from "@/lib/calendar";
import { POLICY_COPY } from "@/lib/policy";
import { enablePushReminders } from "@/lib/reminders";
import {
  addReview,
  cancelBooking,
  confirmPaidBooking,
  getMyAvailability,
  listMyBookings,
  listNotifications,
  listTrainerSessions,
  markNotificationsRead,
  reportNoShow,
  saveMyAvailability,
  type BookingRow,
  type TrainerSession,
} from "@/lib/server/queries";
import { cn, formatDayLA, formatMoney, formatTimeLA, laDayKey, pad2 } from "@/lib/utils";

export const Route = createFileRoute("/bookings")({
  component: BookingsPage,
  errorComponent: BookingsCrash,
});

function BookingsCrash({ reset }: { error?: unknown; reset: () => void }) {
  return (
    <div className="space-y-3">
      <h1 className="font-display text-3xl tracking-wide">Bookings</h1>
      <p className="text-sm text-muted">This tab hit a snag. Your sessions are still saved.</p>
      <Button onClick={reset}>Reload bookings</Button>
    </div>
  );
}

function BookingsPage() {
  const { user, isPending } = useCurrentUserState();
  if (isPending) return <p className="text-sm text-muted">Loading bookings…</p>;
  if (!user) {
    return (
      <GuestPrompt
        title="Bookings"
        blurb="Log in to see upcoming sessions, your calendar, and reviews."
        next="/bookings"
      />
    );
  }
  return <BookingsAuthed />;
}

/** Calendar-cell key for a grid day (a plain calendar date, no time zone math). */
function cellKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Sessions happen in LA, so group and label them on the LA calendar. */
function sessionDayKey(iso: string) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "unknown" : laDayKey(d);
}

function dayLabel(iso: string) {
  return formatDayLA(iso) || "Date TBD";
}

function timeLabel(iso: string) {
  return formatTimeLA(iso);
}

function BookingsAuthed() {
  const { user } = useCurrentUserState();
  const qc = useQueryClient();
  const bookings = useQuery({
    queryKey: ["bookings"],
    queryFn: () => listMyBookings(),
    enabled: !!user,
    placeholderData: [],
  });
  const desk = useQuery({
    queryKey: ["trainer-sessions"],
    queryFn: () => listTrainerSessions(),
    enabled: !!user,
    placeholderData: { isTrainer: false, sessions: [] },
  });
  const notes = useQuery({
    queryKey: ["notifications"],
    queryFn: () => listNotifications(),
    enabled: !!user,
    placeholderData: [],
  });
  const [reviewFor, setReviewFor] = useState<BookingRow | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");

  useEffect(() => {
    const paid = new URLSearchParams(window.location.search).get("paid");
    if (!paid) return;
    void confirmPaidBooking({ data: paid })
      .then((res) => {
        if (res?.ok) {
          toast.success("Payment received. Your session is confirmed.");
          window.history.replaceState({}, "", "/bookings");
        }
        void qc.invalidateQueries({ queryKey: ["bookings"] });
        void qc.invalidateQueries({ queryKey: ["trainer-sessions"] });
      })
      .catch(() => toast.error("Could not confirm that payment."));
  }, [qc]);

  const cancel = useMutation({
    mutationFn: (id: string) => cancelBooking({ data: id }),
    onSuccess: () => {
      toast.success("Booking cancelled.");
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["trainer-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const noshow = useMutation({
    mutationFn: (id: string) => reportNoShow({ data: id }),
    onSuccess: () => {
      toast.success("No-show recorded. Trainer is paid in full.");
      void qc.invalidateQueries({ queryKey: ["bookings"] });
      void qc.invalidateQueries({ queryKey: ["trainer-sessions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const review = useMutation({
    mutationFn: () => addReview({ data: { bookingId: reviewFor!.id, rating, body } }),
    onSuccess: () => {
      toast.success("Review posted.");
      setReviewFor(null);
      setBody("");
      void qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upcoming = (bookings.data ?? []).filter(
    (b) => b.status === "confirmed" && new Date(b.startAt).getTime() > Date.now(),
  );
  const past = (bookings.data ?? []).filter(
    (b) =>
      b.status !== "pending_payment" &&
      !(b.status === "confirmed" && new Date(b.startAt).getTime() > Date.now()),
  );
  const isTrainer = !!desk.data?.isTrainer;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-wide">Bookings</h1>
          <p className="text-sm text-muted">
            {isTrainer ? "Your calendar, clients, and sessions you’ve booked." : "Upcoming sessions, history, and reviews."}
          </p>
          <p className="mt-1 text-xs text-subtle">{POLICY_COPY}</p>
          <button
            type="button"
            className="mt-2 text-xs text-primary"
            onClick={() =>
              void enablePushReminders().then((ok) =>
                toast[ok ? "success" : "error"](ok ? "Alerts on. We’ll ping you before sessions." : "Allow notifications in Settings."),
              )
            }
          >
            Enable session alerts
          </button>
        </div>
        <Link to="/search" className="text-sm text-primary">
          Book another
        </Link>
      </div>

      {(notes.data ?? []).length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium uppercase tracking-wide text-muted">Activity</h2>
            <button
              type="button"
              className="text-xs text-subtle hover:text-fg"
              onClick={() => void markNotificationsRead().then(() => qc.invalidateQueries({ queryKey: ["notifications"] }))}
            >
              Mark read
            </button>
          </div>
          <ul className="space-y-2">
            {(notes.data ?? []).slice(0, 4).map((n) => (
              <li key={n.id} className="rounded-lg bg-surface px-3 py-2.5 text-sm shadow-[var(--shadow-border)]">
                {n.href ? (
                  <a href={n.href} className="block">
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted">{n.body}</p>
                  </a>
                ) : (
                  <>
                    <p className="font-medium">{n.title}</p>
                    <p className="text-muted">{n.body}</p>
                  </>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isTrainer && (
        <>
          <HoursEditor />
          <TrainerCalendar sessions={desk.data?.sessions ?? []} loading={desk.isLoading} />
        </>
      )}

      {bookings.isPlaceholderData ? (
        <p className="text-sm text-muted">Loading bookings…</p>
      ) : upcoming.length + past.length === 0 ? (
        <p className="text-sm text-muted">{isTrainer ? "You haven’t booked a session as a trainee." : "Nothing on the books. Find a coach and grab a slot."}</p>
      ) : bookings.data ? (
        <>
          <List
            title={isTrainer ? "Sessions you booked" : "Upcoming"}
            rows={upcoming}
            empty={isTrainer ? "You haven’t booked a session as a trainee." : "Nothing on the books. Find a coach and grab a slot."}
          >
            {(b) => (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    addToDeviceCalendar({
                      id: b.id,
                      title: `${b.serviceName} with ${b.trainerName}`,
                      startAt: b.startAt,
                      durationMin: b.durationMin,
                      location: [b.locationLabel, b.locationNote, b.gymName].filter(Boolean).join(" · "),
                      description: `Mittwork · ${b.serviceName} with ${b.trainerName}`,
                    });
                    toast.success("Opening your calendar…");
                  }}
                >
                  <CalendarPlus className="size-3.5" />
                  Add to calendar
                </Button>
                <Button size="sm" variant="secondary" asChild>
                  <Link to="/inbox/$bookingId" params={{ bookingId: b.id }}>
                    Message
                  </Link>
                </Button>
                {b.canCancelFree ? (
                  <Button size="sm" variant="danger" onClick={() => cancel.mutate(b.id)} disabled={cancel.isPending}>
                    Cancel
                  </Button>
                ) : (
                  <Button size="sm" variant="danger" onClick={() => noshow.mutate(b.id)} disabled={noshow.isPending}>
                    No-show
                  </Button>
                )}
              </div>
            )}
          </List>
          <List title="Past" rows={past} empty="No past sessions yet.">
            {(b) =>
              b.canReview ? (
                <Button size="sm" className="mt-3" onClick={() => setReviewFor(b)}>
                  Leave a review
                </Button>
              ) : b.status === "cancelled" ? (
                <p className="mt-2 text-xs text-danger">Cancelled</p>
              ) : b.status === "no_show" ? (
                <p className="mt-2 text-xs text-warn">No-show · trainer paid in full</p>
              ) : b.canNoShow ? (
                <Button size="sm" className="mt-3" variant="danger" onClick={() => noshow.mutate(b.id)}>
                  Report no-show
                </Button>
              ) : null
            }
          </List>
        </>
      ) : null}

      <Modal open={!!reviewFor} onClose={() => setReviewFor(null)} title="How was the session?">
        {reviewFor && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              review.mutate();
            }}
          >
            <p className="text-sm text-muted">
              {reviewFor.serviceName} with {reviewFor.trainerName}
            </p>
            <div>
              <Label>Rating</Label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={
                      n <= rating
                        ? "size-11 rounded-md bg-primary text-sm font-medium tabular-nums text-primary-fg"
                        : "size-11 rounded-md bg-elevated text-sm font-medium tabular-nums text-muted"
                    }
                    aria-label={`${n} stars`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label htmlFor="rev">Review</Label>
              <Textarea id="rev" required minLength={8} value={body} onChange={(e) => setBody(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={review.isPending}>
              Post review
            </Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

function TrainerCalendar({ sessions, loading }: { sessions: TrainerSession[]; loading: boolean }) {
  const now = new Date();
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(() => laDayKey(now));

  const byDay = useMemo(() => {
    const map = new Map<string, TrainerSession[]>();
    for (const s of sessions) {
      if (s.status === "cancelled" || s.status === "pending_payment") continue;
      const k = sessionDayKey(s.startAt);
      const list = map.get(k) ?? [];
      list.push(s);
      map.set(k, list);
    }
    for (const list of map.values()) list.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    return map;
  }, [sessions]);

  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    const out: Date[][] = [];
    const cur = new Date(start);
    for (let w = 0; w < 6; w += 1) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d += 1) {
        week.push(new Date(cur));
        cur.setDate(cur.getDate() + 1);
      }
      out.push(week);
      if (cur.getMonth() !== month && cur.getDay() === 0) break;
    }
    return out;
  }, [cursor]);

  const selectedSessions = byDay.get(selected) ?? [];
  const upcoming = sessions
    .filter((s) => s.status === "confirmed" && new Date(s.startAt).getTime() >= Date.now())
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  const monthTitle = cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  if (loading) return <Skeleton className="h-72 rounded-xl" />;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-wide">Calendar</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="size-5" />
          </button>
          <p className="min-w-36 text-center text-sm font-medium">{monthTitle}</p>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-md text-muted hover:bg-elevated hover:text-fg"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-border)]">
        <div className="grid grid-cols-7 border-b border-border text-center text-[11px] uppercase tracking-wide text-muted">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
            <div key={d} className="py-2">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {weeks.flat().map((day, i) => {
            const k = cellKey(day);
            const inMonth = day.getMonth() === cursor.getMonth();
            const count = byDay.get(k)?.length ?? 0;
            const isSel = k === selected;
            const isToday = k === laDayKey(now);
            return (
              <button
                key={`${k}-${i}`}
                type="button"
                onClick={() => setSelected(k)}
                className={cn(
                  "relative flex h-12 flex-col items-center justify-center text-sm",
                  !inMonth && "text-subtle",
                  isSel && "bg-primary text-white",
                  !isSel && isToday && "text-primary",
                )}
              >
                {day.getDate()}
                {count > 0 && (
                  <span
                    className={cn(
                      "mt-0.5 size-1.5 rounded-full",
                      isSel ? "bg-white" : "bg-primary",
                    )}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted">
          {selectedSessions.length
            ? new Date(selected + "T12:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
              })
            : "No sessions this day"}
        </h3>
        {selectedSessions.length === 0 ? (
          <p className="text-sm text-muted">Tap a marked day to see who booked you.</p>
        ) : (
          <ul className="space-y-3">
            {selectedSessions.map((s) => (
              <TrainerSessionCard key={s.id} session={s} />
            ))}
          </ul>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted">Coming up</h3>
          <ul className="space-y-3">
            {upcoming.slice(0, 8).map((s) => (
              <TrainerSessionCard key={`up-${s.id}`} session={s} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function TrainerSessionCard({ session: s }: { session: TrainerSession }) {
  return (
    <li className="rounded-xl bg-surface p-3.5 shadow-[var(--shadow-border)]">
      <div className="flex gap-3">
        {s.clientPhoto ? (
          <img src={s.clientPhoto} alt="" width={48} height={48} loading="lazy" decoding="async" className="size-12 rounded-full object-cover" />
        ) : (
          <div className="grid size-12 place-items-center rounded-full bg-elevated text-sm font-medium">
            {(s.clientName || "C").slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{s.clientName}</p>
          <p className="text-sm text-muted">{s.serviceName}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm">
            <Clock className="size-3.5 text-subtle" />
            {dayLabel(s.startAt)} · {timeLabel(s.startAt)} · {s.durationMin} min
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="size-3.5 text-subtle" />
            {s.locationLabel}
            {s.locationNote ? ` · ${s.locationNote}` : ""}
          </p>
          {s.gymName && s.locationType === "trainer_gym" && (
            <p className="text-xs text-subtle">{s.gymName}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                addToDeviceCalendar({
                  id: s.id,
                  title: `${s.serviceName} with ${s.clientName}`,
                  startAt: s.startAt,
                  durationMin: s.durationMin,
                  location: [s.locationLabel, s.locationNote, s.gymName].filter(Boolean).join(" · "),
                  description: `Mittwork · ${s.clientName} booked ${s.serviceName}`,
                });
                toast.success("Opening your calendar…");
              }}
            >
              <CalendarPlus className="size-3.5" />
              Add to calendar
            </Button>
            <Button size="sm" variant="secondary" asChild>
              <Link to="/inbox/$bookingId" params={{ bookingId: s.id }}>
                Message
              </Link>
            </Button>
            {s.canCancelFree && <CancelSessionButton id={s.id} />}
            {s.status === "confirmed" && new Date(s.startAt).getTime() <= Date.now() + 15 * 60_000 && (
              <NoShowButton id={s.id} />
            )}
          </div>
          <div className="mt-2 space-y-0.5 text-xs text-subtle">
            {s.clientEmail && (
              <p className="flex items-center gap-1.5">
                <Mail className="size-3" />
                {s.clientEmail}
              </p>
            )}
            {s.clientPhone && (
              <p className="flex items-center gap-1.5">
                <Phone className="size-3" />
                {s.clientPhone}
              </p>
            )}
          </div>
          {s.notes && <p className="mt-2 text-xs text-muted">Note: {s.notes}</p>}
          <p className="mt-1 text-xs tabular-nums text-subtle">{formatMoney(s.amountCents)}</p>
        </div>
      </div>
    </li>
  );
}

function List({
  title,
  rows,
  empty,
  children,
}: {
  title: string;
  rows: BookingRow[];
  empty: string;
  children: (b: BookingRow) => React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-display text-2xl tracking-wide">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((b) => (
            <li key={b.id} className="flex gap-3 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]">
              {b.trainerPhoto ? (
                <img src={b.trainerPhoto} alt="" width={64} height={64} loading="lazy" decoding="async" className="size-16 rounded-md object-cover" />
              ) : (
                <div className="grid size-16 place-items-center rounded-md bg-elevated text-sm font-medium">
                  {(b.trainerName || "T").slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="font-medium">{b.trainerName}</p>
                <p className="text-sm text-muted">{b.serviceName}</p>
                <p className="text-xs text-subtle">
                  {dayLabel(b.startAt)} · {timeLabel(b.startAt)}
                </p>
                <p className="text-xs text-subtle">
                  {b.locationLabel || b.gymName}
                  {b.locationNote ? ` · ${b.locationNote}` : ""}
                </p>
                <p className="text-xs tabular-nums text-subtle">{formatMoney(b.amountCents)}</p>
                {children(b)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CancelSessionButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => cancelBooking({ data: id }),
    onSuccess: () => {
      toast.success("Session cancelled. The client is refunded.");
      void qc.invalidateQueries({ queryKey: ["trainer-sessions"] });
      void qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant="danger" onClick={() => m.mutate()} disabled={m.isPending}>
      Cancel
    </Button>
  );
}

function NoShowButton({ id }: { id: string }) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => reportNoShow({ data: id }),
    onSuccess: () => {
      toast.success("No-show recorded. You’re still paid in full.");
      void qc.invalidateQueries({ queryKey: ["trainer-sessions"] });
      void qc.invalidateQueries({ queryKey: ["bookings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Button size="sm" variant="danger" onClick={() => m.mutate()} disabled={m.isPending}>
      No-show
    </Button>
  );
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function HoursEditor() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["avail"], queryFn: () => getMyAvailability() });
  const [days, setDays] = useState<{ weekday: number; startMin: number; endMin: number }[]>([]);
  useEffect(() => {
    if (Array.isArray(q.data)) setDays(q.data);
  }, [q.data]);
  const save = useMutation({
    mutationFn: () => saveMyAvailability({ data: { days } }),
    onSuccess: () => {
      toast.success("Hours saved. Clients only see these times.");
      void qc.invalidateQueries({ queryKey: ["avail"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggle(weekday: number) {
    setDays((prev) => {
      const has = prev.some((d) => d.weekday === weekday);
      if (has) return prev.filter((d) => d.weekday !== weekday);
      return [...prev, { weekday, startMin: 16 * 60, endMin: 20 * 60 }].sort((a, b) => a.weekday - b.weekday);
    });
  }

  function setTime(weekday: number, field: "startMin" | "endMin", value: string) {
    const [h, m] = value.split(":").map(Number);
    const mins = (h || 0) * 60 + (m || 0);
    setDays((prev) => prev.map((d) => (d.weekday === weekday ? { ...d, [field]: mins } : d)));
  }

  function clock(min: number) {
    return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  }

  return (
    <section className="space-y-3 rounded-xl bg-surface p-4 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-2xl tracking-wide">Your hours</h2>
      <p className="text-xs text-subtle">Turn on the days you take sessions, then set open and close. Clients only see those slots.</p>
      <div className="flex flex-wrap gap-1.5">
        {DAY_NAMES.map((name, i) => (
          <button
            key={name}
            type="button"
            onClick={() => toggle(i)}
            className={cn(
              "h-10 min-w-12 rounded-full px-3 text-sm",
              days.some((d) => d.weekday === i) ? "bg-cta text-cta-fg" : "bg-elevated text-muted",
            )}
          >
            {name}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {days.map((d) => (
          <li key={d.weekday} className="flex items-center gap-2 text-sm">
            <span className="w-10 shrink-0 font-medium">{DAY_NAMES[d.weekday]}</span>
            <input
              type="time"
              value={clock(d.startMin)}
              onChange={(e) => setTime(d.weekday, "startMin", e.target.value)}
              className="h-10 flex-1 rounded-full bg-elevated px-3 text-base"
            />
            <span className="text-subtle">–</span>
            <input
              type="time"
              value={clock(d.endMin)}
              onChange={(e) => setTime(d.weekday, "endMin", e.target.value)}
              className="h-10 flex-1 rounded-full bg-elevated px-3 text-base"
            />
          </li>
        ))}
      </ul>
      <Button size="sm" variant="cta" className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        Save schedule
      </Button>
    </section>
  );
}
