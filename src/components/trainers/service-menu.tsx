import { SERVICE_TYPES, STYLES } from "@/lib/catalog";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { emptyService, type MenuRow } from "@/components/trainers/service-menu-model";

export function ServiceMenu({
  items,
  onChange,
}: {
  items: MenuRow[];
  onChange: (next: MenuRow[]) => void;
}) {
  function patch(key: string, part: Partial<MenuRow>) {
    onChange(items.map((x) => (x.key === key ? { ...x, ...part } : x)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-display text-xl tracking-wide">Offerings</h3>
          <p className="text-xs text-subtle">Add every session you sell. Price is for the listed length — clients can book other lengths.</p>
        </div>
        <button
          type="button"
          className="shrink-0 text-sm text-primary"
          onClick={() => onChange([...items, emptyService(items[0]?.style || "boxing")])}
        >
          Add service
        </button>
      </div>
      {items.map((s, i) => (
        <div key={s.key} className="space-y-2 rounded-xl bg-elevated p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-subtle">Service {i + 1}</p>
            {items.length > 1 && (
              <button type="button" className="text-xs text-muted" onClick={() => onChange(items.filter((x) => x.key !== s.key))}>
                Remove
              </button>
            )}
          </div>
          <Input value={s.name} placeholder="Mittwork session" onChange={(e) => patch(s.key, { name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={s.style}
              onChange={(e) => patch(s.key, { style: e.target.value })}
              className="h-11 rounded-md bg-bg px-3 text-sm"
            >
              {STYLES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
            <select
              value={s.serviceType}
              onChange={(e) => patch(s.key, { serviceType: e.target.value })}
              className="h-11 rounded-md bg-bg px-3 text-sm"
            >
              {SERVICE_TYPES.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Listed minutes</Label>
              <Input
                type="number"
                min={15}
                max={180}
                value={s.durationMin}
                onChange={(e) => patch(s.key, { durationMin: Number(e.target.value) || 60 })}
              />
            </div>
            <div>
              <Label>Price (USD)</Label>
              <Input
                type="number"
                min={5}
                value={Math.round(s.priceCents / 100)}
                onChange={(e) => patch(s.key, { priceCents: Math.round(Number(e.target.value) * 100) })}
              />
            </div>
          </div>
          <Input
            value={s.description}
            placeholder="What’s in the round"
            onChange={(e) => patch(s.key, { description: e.target.value })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={() => onChange([...items, emptyService(items[0]?.style || "boxing")])}
      >
        Add another service
      </Button>
    </div>
  );
}
