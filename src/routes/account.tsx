import { useEffect, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { NeedSignIn } from "@/components/auth/need-sign-in";
import { GalleryEditor, PhotoPicker } from "@/components/media/uploader";
import { emptyService, ServiceMenu, type MenuRow } from "@/components/trainers/service-menu";
import { PlaceOptions } from "@/components/trainers/place-options";
import { StripePayoutCard } from "@/components/trainers/stripe-payouts";
import { CitySearch } from "@/components/location/city-search";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Label, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { STYLES } from "@/lib/catalog";
import { ALL_PLACE_IDS, type SessionPlaceId } from "@/lib/locations";
import { openExternal } from "@/lib/open-external";
import { useOrigin } from "@/lib/origin";
import type { MediaItem } from "@/lib/media";
import {
  becomeTrainer,
  claimGym,
  getMyGym,
  getMyProfile,
  listGyms,
  saveMyPhoto,
  saveMyServices,
  saveTrainerGallery,
  startTrainerPayouts,
  updateMyProfile,
  updateTrainerProfile,
} from "@/lib/server/queries";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  return (
    <NeedSignIn>
      <AccountForm />
    </NeedSignIn>
  );
}

function AccountForm() {
  const { user } = useCurrentUserState();
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: () => getMyProfile(), enabled: !!user });
  const gyms = useQuery({
    queryKey: ["gyms-all"],
    queryFn: () => listGyms({ data: {} }),
  });

  const origin = useOrigin();
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [headline, setHeadline] = useState("");
  const [yearsExp, setYearsExp] = useState(1);
  const [gymId, setGymId] = useState("");
  const [gymName, setGymName] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [gallery, setGallery] = useState<MediaItem[]>([]);
  const [places, setPlaces] = useState<SessionPlaceId[]>([...ALL_PLACE_IDS]);
  const [menu, setMenu] = useState<MenuRow[]>([emptyService()]);
  const [busy, setBusy] = useState(false);
  const [showTrainer, setShowTrainer] = useState(false);

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName || user?.displayName || "");
    setPhone(profile.data.phone || "");
    setCity(profile.data.city || profile.data.trainer?.city || "");
    if (profile.data.trainer && Number.isFinite(profile.data.trainer.lat)) {
      setHomeLat(profile.data.trainer.lat);
      setHomeLng(profile.data.trainer.lng);
    }
    setBio(profile.data.bio || profile.data.trainer?.bio || "");
    setPhotoUrl(profile.data.photoUrl || profile.data.trainer?.photoUrl || user?.profileImageUrl || "");
    if (profile.data.trainer) {
      setHeadline(profile.data.trainer.headline);
      setYearsExp(profile.data.trainer.yearsExp);
      setGymId(profile.data.trainer.gymId);
      setGymName(profile.data.trainer.gymName || "");
      setSpecs(profile.data.trainer.specialties);
      setGallery(profile.data.trainer.gallery);
      setPlaces(profile.data.trainer.places?.length ? profile.data.trainer.places : [...ALL_PLACE_IDS]);
      setMenu(
        (profile.data.trainer.services.length ? profile.data.trainer.services : []).map((s, i) => ({
          key: s.id || `new-${i}`,
          id: s.id,
          name: s.name,
          style: s.style,
          serviceType: s.serviceType,
          description: s.description,
          durationMin: s.durationMin,
          priceCents: s.priceCents,
        })),
      );
      if (!profile.data.trainer.services.length) setMenu([emptyService()]);
      setShowTrainer(true);
    }
  }, [profile.data, user?.displayName, user?.profileImageUrl]);

  async function persistPhoto(url: string) {
    setPhotoUrl(url);
    try {
      await saveMyPhoto({ data: { photoUrl: url } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Photo saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save photo.");
    }
  }

  async function persistGallery(next: MediaItem[]) {
    setGallery(next);
    if (!profile.data?.trainer) {
      toast.success("Added. Publish your trainer profile to keep it on your page.");
      return;
    }
    try {
      await saveTrainerGallery({ data: { gallery: next } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Gallery saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save gallery.");
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updateMyProfile({
        data: {
          displayName: displayName.trim() || "Athlete",
          city,
          phone,
          bio,
          photoUrl: photoUrl || undefined,
          role: profile.data?.trainer ? "trainer" : "client",
        },
      });
      if (profile.data?.trainer) {
        if (!gymName.trim() && !gymId) throw new Error("Type your home gym.");
        if (!specs.length) throw new Error("Pick at least one specialty.");
        await updateTrainerProfile({
          data: {
            name: displayName.trim(),
            headline: headline.trim() || "Available for sessions",
            bio: bio.trim(),
            photoUrl: photoUrl || profile.data.trainer.photoUrl,
            specialties: specs,
            yearsExp,
            gymId: gymId || undefined,
            gymName: gymName.trim(),
            city: city || undefined,
            lat: homeLat ?? undefined,
            lng: homeLng ?? undefined,
            gallery,
            locationOptions: places,
          },
        });
        const rows = menu.filter((s) => s.name.trim());
        if (rows.length) {
          await saveMyServices({
            data: {
              services: rows.map((s) => ({
                id: s.id,
                name: s.name.trim(),
                style: s.style,
                serviceType: s.serviceType,
                description: s.description,
                durationMin: s.durationMin,
                priceCents: s.priceCents,
              })),
            },
          });
        }
      }
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }

  async function createTrainer() {
    if (!displayName.trim()) {
      toast.error("Add your name first.");
      return;
    }
    if (!gymName.trim()) {
      toast.error("Type the name of your home gym.");
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
      await updateMyProfile({
        data: { displayName: displayName.trim(), city, phone, bio, photoUrl: photoUrl || undefined, role: "trainer" },
      });
      await becomeTrainer({
        data: {
          name: displayName.trim(),
          headline: headline.trim() || "Available for sessions",
          bio: bio.trim() || "Book a round.",
          gymName: gymName.trim(),
          city: city || undefined,
          lat: homeLat ?? undefined,
          lng: homeLng ?? undefined,
          specialties: specs,
          photoUrl: photoUrl || undefined,
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
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Trainer profile is live.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create trainer profile.");
    } finally {
      setBusy(false);
    }
  }

  async function saveMenu() {
    if (!profile.data?.trainer) {
      toast.error("Publish your trainer profile first, then add more offerings.");
      return;
    }
    const rows = menu.filter((s) => s.name.trim());
    if (!rows.length) {
      toast.error("Add at least one service.");
      return;
    }
    setBusy(true);
    try {
      await saveMyServices({
        data: {
          services: rows.map((s) => ({
            id: s.id || undefined,
            name: s.name.trim(),
            style: s.style,
            serviceType: s.serviceType,
            description: s.description,
            durationMin: s.durationMin,
            priceCents: s.priceCents,
          })),
        },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Offerings saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save offerings.");
    } finally {
      setBusy(false);
    }
  }

  async function connectPayouts() {
    setBusy(true);
    try {
      const res = await startTrainerPayouts({ data: { origin: window.location.origin } });
      if (!res.url) throw new Error("Stripe did not return a sign-in link.");
      openExternal(res.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Stripe.");
    } finally {
      setBusy(false);
    }
  }

  if (profile.isLoading) return <Skeleton className="h-48 rounded-xl" />;
  const isTrainer = !!profile.data?.trainer;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl tracking-wide">Account</h1>
        <p className="text-sm text-muted">
          {user?.primaryEmail || "Signed in"}
          {isTrainer ? " · Trainer" : " · Trainee"}
        </p>
        <Link to="/bookings" className="mt-2 inline-block text-sm text-primary">
          View bookings
        </Link>
        {isTrainer && (
          <Link to="/earnings" className="mt-2 ml-4 inline-block text-sm text-primary">
            Earnings
          </Link>
        )}
      </div>
      <UserButton />

      <form className="space-y-5" onSubmit={(e) => void save(e)}>
        <PhotoPicker value={photoUrl} onChange={(url) => void persistPhoto(url)} label="Profile photo" round />
        <p className="text-xs text-subtle">Works with Google or email. Tap the circle any time to change it.</p>
        <div>
          <Label htmlFor="dn">Name</Label>
          <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
        </div>
        <div>
          <Label htmlFor="ph">Phone</Label>
          <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
        </div>
        <div>
          <Label htmlFor="city">Hometown</Label>
          <CitySearch
            value={city}
            onSelect={(p) => {
              setCity(p.label);
              setHomeLat(p.lat);
              setHomeLng(p.lng);
            }}
            placeholder="Any city in the world"
          />
        </div>
        <div>
          <Label htmlFor="bio">{isTrainer ? "Bio" : "About you"}</Label>
          <Textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder={isTrainer ? "How you train people." : "What you want from a coach."}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "Saving…" : "Save profile"}
        </Button>
      </form>

      <section className="space-y-4 border-t border-border pt-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl tracking-wide">Trainer</h2>
          {!isTrainer && (
            <button type="button" className="text-sm text-primary" onClick={() => setShowTrainer((v) => !v)}>
              {showTrainer ? "Hide" : "Become a trainer"}
            </button>
          )}
        </div>

        {(isTrainer || showTrainer) && (
          <div className="space-y-4">
            <div>
              <Label htmlFor="h">Headline</Label>
              <Input
                id="h"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Pad holding for strikers."
              />
            </div>
            <div>
              <Label htmlFor="ye">Years coaching</Label>
              <Input
                id="ye"
                type="number"
                min={0}
                max={50}
                value={yearsExp}
                onChange={(e) => setYearsExp(Number(e.target.value))}
              />
            </div>
            <div>
              <Label htmlFor="g">Home gym</Label>
              <Input
                id="g"
                value={gymName}
                onChange={(e) => {
                  const v = e.target.value;
                  setGymName(v);
                  const hit = (gyms.data ?? []).find((g) => g.name === v);
                  setGymId(hit?.id ?? "");
                }}
                placeholder="e.g. Wildomar Boxing Club"
                list="gym-suggestions"
              />
              <datalist id="gym-suggestions">
                {(gyms.data ?? []).slice(0, 40).map((g) => (
                  <option key={g.id} value={g.name} />
                ))}
              </datalist>
              <p className="mt-1 text-xs text-subtle">Type the gym you train out of. If it isn’t listed yet, that’s fine — we’ll add it.</p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Specialties</p>
              <div className="flex flex-wrap gap-1.5">
                {STYLES.map((s) => (
                  <Chip
                    key={s.id}
                    active={specs.includes(s.id)}
                    onClick={() =>
                      setSpecs((prev) => (prev.includes(s.id) ? prev.filter((x) => x !== s.id) : [...prev, s.id]))
                    }
                  >
                    {s.label}
                  </Chip>
                ))}
              </div>
            </div>
            <GalleryEditor items={gallery} onChange={(next) => void persistGallery(next)} />
            <PlaceOptions value={places} onChange={setPlaces} />

            <ServiceMenu items={menu} onChange={setMenu} />
            {isTrainer ? (
              <Button type="button" className="w-full" disabled={busy} onClick={() => void saveMenu()}>
                {busy ? "Saving…" : "Save offerings"}
              </Button>
            ) : (
              <Button type="button" className="w-full" disabled={busy} onClick={() => void createTrainer()}>
                {busy ? "Publishing…" : "Publish trainer profile"}
              </Button>
            )}

            {isTrainer && (
              <>
                <StripePayoutCard
                  onboarded={!!profile.data?.trainer?.stripeOnboarded}
                  busy={busy}
                  onConnect={() => void connectPayouts()}
                />
                <GymDesk gymId={profile.data?.trainer?.gymId} gymName={gymName} />
              </>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function GymDesk({ gymId, gymName }: { gymId?: string; gymName: string }) {
  const qc = useQueryClient();
  const mine = useQuery({ queryKey: ["my-gym"], queryFn: () => getMyGym(), enabled: !!gymId });
  const [hours, setHours] = useState("");
  const [phone, setPhone] = useState("");
  const [desc, setDesc] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [gallery, setGallery] = useState<MediaItem[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!mine.data) return;
    setHours(mine.data.hours || "");
    setPhone(mine.data.phone || "");
    setDesc(mine.data.description || "");
    setPhotoUrl(mine.data.photoUrl || "");
    setGallery((mine.data.gallery || []).map((url) => ({ url, kind: "photo" as const })));
  }, [mine.data]);

  async function save() {
    setBusy(true);
    try {
      await claimGym({
        data: {
          gymId,
          gymName,
          hours,
          phone,
          description: desc,
          photoUrl: photoUrl || undefined,
          gallery: [photoUrl, ...gallery.map((g) => g.url)].filter(Boolean),
        },
      });
      await qc.invalidateQueries({ queryKey: ["my-gym"] });
      toast.success("Gym profile saved. Your trainers list on the gym page.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save gym.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl bg-elevated p-4">
      <h3 className="font-display text-xl tracking-wide">Gym profile</h3>
      <p className="text-xs text-subtle">
        Claim {gymName || "your home gym"} so it shows under Gyms with photos and the trainers who work there.
      </p>
      <PhotoPicker value={photoUrl} onChange={setPhotoUrl} label="Gym photo" />
      <GalleryEditor items={gallery} onChange={setGallery} />
      <div>
        <Label htmlFor="gh">Hours</Label>
        <Input id="gh" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="Mon–Fri 6a–9p" />
      </div>
      <div>
        <Label htmlFor="gp">Gym phone</Label>
        <Input id="gp" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="gd">About the gym</Label>
        <Textarea id="gd" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
      <Button type="button" variant="cta" className="w-full" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : mine.data ? "Update gym" : "Claim gym profile"}
      </Button>
    </div>
  );
}
