import { useEffect, useId, useRef, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { searchPlaces, type Place } from "@/lib/places";
import { cn } from "@/lib/utils";

export function CitySearch({
  value,
  onSelect,
  placeholder = "Search any city in the world",
  className,
}: {
  value?: string;
  onSelect: (place: Place) => void;
  placeholder?: string;
  className?: string;
}) {
  const [q, setQ] = useState(value ?? "");
  const [open, setOpen] = useState(false);
  const [hits, setHits] = useState<Place[]>([]);
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    setQ(value ?? "");
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    const handle = window.setTimeout(() => {
      void searchPlaces(q).then((places) => {
        if (!cancelled) {
          setHits(places);
          setActive(0);
        }
      });
    }, q.trim().length >= 2 ? 220 : 0);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function pick(place: Place) {
    setQ(place.label);
    setOpen(false);
    onSelect(place);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
      <input
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, hits.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && hits[active]) {
            e.preventDefault();
            pick(hits[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-12 w-full rounded-md bg-elevated pl-9 pr-3 text-base text-fg shadow-[var(--shadow-border)] placeholder:text-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      {open && hits.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg bg-surface py-1 shadow-[var(--shadow-border-hover)]"
        >
          {hits.map((p, i) => (
            <li key={`${p.label}-${p.lat}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm",
                  i === active ? "bg-elevated text-fg" : "text-muted hover:bg-elevated hover:text-fg",
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => pick(p)}
              >
                <MapPin className="size-3.5 shrink-0 text-primary" />
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
