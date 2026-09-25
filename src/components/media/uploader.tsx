import { useRef, useState } from "react";
import { Camera, Plus, Trash2, Video } from "lucide-react";
import { toast } from "sonner";
import { shrinkVideo, type MediaItem } from "@/lib/media";
import { uploadBlob, uploadPhotoFile, uploadPosterDataUrl } from "@/lib/media-upload";
import { LazyVideo } from "@/components/media/lazy-video";
import { cn } from "@/lib/utils";

export function PhotoPicker({
  value,
  onChange,
  label = "Photo",
  round = false,
}: {
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  round?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/") && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
      toast.error("Pick a photo.");
      return;
    }
    setBusy(true);
    try {
      onChange(await uploadPhotoFile(file));
      toast.success("Photo ready.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not read that photo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative grid place-items-center overflow-hidden bg-elevated shadow-[var(--shadow-border)]",
          round ? "size-28 rounded-full" : "h-36 w-36 rounded-xl",
        )}
      >
        {value ? (
          <img src={value} alt="" className="size-full object-cover" />
        ) : (
          <Camera className="size-7 text-muted" />
        )}
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[11px] text-white">
          {busy ? "Saving…" : value ? "Change" : "Add photo"}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          void onFile(f);
        }}
      />
    </div>
  );
}

export function GalleryEditor({
  items,
  onChange,
}: {
  items: MediaItem[];
  onChange: (next: MediaItem[]) => void;
}) {
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  async function addPhotos(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    const next = [...items];
    try {
      for (let i = 0; i < files.length; i += 1) {
        if (next.length >= 24) break;
        setStatus(`Photo ${i + 1} of ${files.length}…`);
        const url = await uploadPhotoFile(files[i]!);
        next.push({ url, kind: "photo" });
      }
      onChange(next);
      toast.success(files.length > 1 ? "Photos added." : "Photo added.");
    } catch (err) {
      onChange(next);
      toast.error(err instanceof Error ? err.message : "Could not add photo.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  async function addVideos(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    const next = [...items];
    try {
      for (let i = 0; i < files.length; i += 1) {
        if (next.length >= 24) break;
        const file = files[i]!;
        const label = files.length > 1 ? `${i + 1} of ${files.length}` : "clip";
        setStatus(`Preparing ${label}…`);
        const prepared = await shrinkVideo(file, (s) => setStatus(`${s} (${label})`));
        setStatus(`Saving ${label}…`);
        const url = await uploadBlob(prepared.blob, prepared.mime, (s) => setStatus(`${s} (${label})`));
        const poster = prepared.poster ? await uploadPosterDataUrl(prepared.poster) : undefined;
        next.push({ url, kind: "video", poster });
      }
      onChange(next);
      toast.success(files.length > 1 ? "Videos added." : "Video added.");
    } catch (err) {
      onChange(next);
      toast.error(err instanceof Error ? err.message : "Could not add video.");
    } finally {
      setBusy(false);
      setStatus("");
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">Photos & videos</p>
      <p className="text-xs text-subtle">Add multiple clips. Short rounds upload in a few seconds.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {items.map((item, i) => (
          <div key={`${item.url.slice(0, 40)}-${i}`} className="relative aspect-square overflow-hidden rounded-lg bg-elevated">
            {item.kind === "video" ? (
              <LazyVideo src={item.url} poster={item.poster} className="size-full object-cover" />
            ) : (
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
            <button
              type="button"
              aria-label="Remove"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="absolute right-1 top-1 z-10 grid size-7 place-items-center rounded-full bg-black/70 text-white"
            >
              <Trash2 className="size-3.5" />
            </button>
            {item.kind === "video" && (
              <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                Video
              </span>
            )}
          </div>
        ))}
        {items.length < 24 && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => photoRef.current?.click()}
              className="grid aspect-square place-items-center rounded-lg bg-elevated text-muted shadow-[var(--shadow-border)]"
            >
              <span className="flex flex-col items-center gap-1 text-xs">
                <Plus className="size-5" />
                Photo
              </span>
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => videoRef.current?.click()}
              className="grid aspect-square place-items-center rounded-lg bg-elevated text-muted shadow-[var(--shadow-border)]"
            >
              <span className="flex flex-col items-center gap-1 text-xs">
                <Video className="size-5" />
                Video
              </span>
            </button>
          </>
        )}
      </div>
      {busy && <p className="text-xs text-muted">{status || "Working…"}</p>}
      <input
        ref={photoRef}
        type="file"
        accept="image/*,image/heic,image/heif,.heic,.heif"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addPhotos(files);
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept="video/*,.mp4,.mov,.m4v,.webm,video/quicktime"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void addVideos(files);
        }}
      />
    </div>
  );
}
