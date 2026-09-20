import { SESSION_PLACES, placeLabelForTrainer, type SessionPlaceId } from "@/lib/locations";

export function PlaceOptions({
  value,
  onChange,
}: {
  value: SessionPlaceId[];
  onChange: (next: SessionPlaceId[]) => void;
}) {
  function toggle(id: SessionPlaceId) {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Where you train</p>
      <p className="text-xs text-subtle">Clients can only book spots you turn on.</p>
      <ul className="space-y-1.5">
        {SESSION_PLACES.map((p) => {
          const on = value.includes(p.id);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="flex w-full items-center justify-between rounded-lg bg-elevated px-3 py-2.5 text-left text-sm"
              >
                <span>{placeLabelForTrainer(p.id)}</span>
                <span
                  className={
                    on
                      ? "rounded-full bg-primary px-2 py-0.5 text-[11px] text-white"
                      : "rounded-full bg-bg px-2 py-0.5 text-[11px] text-muted"
                  }
                >
                  {on ? "Offered" : "Off"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
