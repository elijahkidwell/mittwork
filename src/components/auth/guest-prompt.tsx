export function GuestPrompt({
  title,
  blurb,
  next,
}: {
  title: string;
  blurb: string;
  next: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl tracking-wide">{title}</h1>
        <p className="mt-1 text-sm text-muted">{blurb}</p>
      </div>
      <a
        href={`/login?redirect=${encodeURIComponent(next)}`}
        className="flex h-14 items-center justify-center rounded-full bg-cta text-[15px] font-semibold tracking-[0.16em] text-cta-fg"
      >
        LOGIN / SIGNUP
      </a>
      <a href="/search" className="block text-center text-sm text-muted">
        Keep browsing trainers
      </a>
    </div>
  );
}
