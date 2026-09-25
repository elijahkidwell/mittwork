import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { PhotoPicker, GalleryEditor } from "@/components/media/uploader";
import { ServiceMenu } from "@/components/trainers/service-menu";
import { emptyService, type MenuRow } from "@/components/trainers/service-menu-model";
import { PlaceOptions } from "@/components/trainers/place-options";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Label, Textarea } from "@/components/ui/input";
import { NeedSignIn } from "@/components/auth/need-sign-in";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { STYLES } from "@/lib/catalog";
import { CitySearch } from "@/components/location/city-search";
import { ALL_PLACE_IDS, type SessionPlaceId } from "@/lib/locations";
import type { MediaItem } from "@/lib/media";
import { becomeTrainer, saveTrainerGallery } from "@/lib/server/queries";

export const Route = createFileRoute("/onboard")({ component: OnboardPage });

function OnboardPage() {
  return (
    <NeedSignIn>
      <OnboardForm />
    </NeedSignIn>
  );
}

function OnboardForm() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.displayName ?? "");
  const [photoUrl, setPhotoUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [bio, setBio] = useState("");
  const [gymName, setGymName] = useState("");
  const [city, setCity] = useState("");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [specs, setSpecs] = useState<string[]>(["boxing"]);
  const [gallery, setGallery] = useState<MediaItem[]>([]);
  const [places, setPlaces] = useState<SessionPlaceId[]>([...ALL_PLACE_IDS]);
  const [menu, setMenu] = useState<MenuRow[]>([{ ...emptyService(), name: "Private session" }]);
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSpecs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!photoUrl) {
      toast.error("Add a profile photo.");
      return;
    }
    if (!gymName.trim()) {
      toast.error("Type the gym you train out of.");
      return;
    }
    if (homeLat == null || homeLng == null || !city.trim()) {
      toast.error("Pick your hometown from the city list.");
      return;
    }
    if (!specs.length) {
      toast.error("Pick at least one specialty.");
      return;
    }
    const rows = menu.filter((s) => s.name.trim());
    if (!rows.length) {
      toast.error("Add at least one service.");
      return;
    }
    if (!places.length) {
      toast.error("Pick at least one place you train.");
      return;
    }
    setBusy(true);
    try {
      await becomeTrainer({
        data: {
          name: name.trim(),
          headline: headline.trim(),
          bio: bio.trim(),
          gymName: gymName.trim(),
          city,
          lat: homeLat,
          lng: homeLng,
          specialties: specs,
          photoUrl,
          locationOptions: places,
          services: rows.map((s) => ({
            name: s.name.trim(),
            style: s.style,
            serviceType: s.serviceType,
            description: s.description,
            durationMin: s.durationMin,
            priceCents: s.priceCents,
          })),
        },
      });
      if (gallery.length) await saveTrainerGallery({ data: { gallery } });
      toast.success("Profile is live.");
      void navigate({ to: "/account" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="mx-auto max-w-lg space-y-5" onSubmit={(e) => void submit(e)}>
      <div>
        <h1 className="font-display text-3xl tracking-wide">Trainer setup</h1>
        <p className="text-sm text-muted">Photo, gym, offerings — then people can book you.</p>
      </div>
      <PhotoPicker value={photoUrl} onChange={setPhotoUrl} label="Profile photo" round />
      <div>
        <Label htmlFor="n">Name</Label>
        <Input id="n" required value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="h">Headline</Label>
        <Input
          id="h"
          required
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="Pad holding for strikers. No reels."
        />
      </div>
      <div>
        <Label htmlFor="b">Bio</Label>
        <Textarea id="b" required minLength={40} value={bio} onChange={(e) => setBio(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="g">Home gym</Label>
        <Input
          id="g"
          required
          value={gymName}
          onChange={(e) => setGymName(e.target.value)}
          placeholder="Type your gym, e.g. Temecula Boxing Club"
        />
      </div>
      <div>
        <Label>Hometown</Label>
        <CitySearch
          value={city}
          onSelect={(p) => {
            setCity(p.label);
            setHomeLat(p.lat);
            setHomeLng(p.lng);
          }}
          placeholder="Temecula, CA"
        />
      </div>
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Specialties</p>
        <div className="flex flex-wrap gap-1.5">
          {STYLES.map((s) => (
            <Chip key={s.id} active={specs.includes(s.id)} onClick={() => toggle(s.id)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>
      <GalleryEditor items={gallery} onChange={setGallery} />
      <PlaceOptions value={places} onChange={setPlaces} />
      <ServiceMenu items={menu} onChange={setMenu} />
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Publishing…" : "Go live"}
      </Button>
    </form>
  );
}
