export type MediaItem = { url: string; kind: "photo" | "video"; poster?: string };

export function isVideoUrl(url: string) {
  return /^data:video\//.test(url) || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || /\/api\/media\//.test(url);
}

export function parseGallery(v: unknown): MediaItem[] {
  let arr: unknown[] = [];
  if (Array.isArray(v)) arr = v;
  else if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      if (Array.isArray(p)) arr = p;
    } catch {
      return [];
    }
  }
  const out: MediaItem[] = [];
  for (const item of arr) {
    if (typeof item === "string" && item) {
      out.push({ url: item, kind: isVideoUrl(item) ? "video" : "photo" });
    } else if (item && typeof item === "object" && "url" in item) {
      const url = String((item as { url: unknown }).url);
      if (!url) continue;
      const kind = (item as { kind?: unknown }).kind === "video" || isVideoUrl(url) ? "video" : "photo";
      const posterRaw = (item as { poster?: unknown }).poster;
      const poster = typeof posterRaw === "string" ? posterRaw : undefined;
      out.push({ url, kind, poster });
    }
  }
  return out;
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(file: File, maxEdge = 720): Promise<string> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not read that photo.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.72);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo. Try a JPG or PNG."));
    };
    img.src = url;
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

function waitVideo(video: HTMLVideoElement, event: string) {
  return new Promise<void>((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error("Could not read that video."));
    };
    const cleanup = () => {
      video.removeEventListener(event, ok);
      video.removeEventListener("error", bad);
    };
    video.addEventListener(event, ok);
    video.addEventListener("error", bad);
  });
}

export function recorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const types = ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

function grabPosterFromVideo(video: HTMLVideoElement): string {
  const canvas = document.createElement("canvas");
  const w = video.videoWidth || 640;
  const h = video.videoHeight || 360;
  const scale = Math.min(1, 480 / Math.max(w, h));
  canvas.width = Math.max(2, Math.round(w * scale));
  canvas.height = Math.max(2, Math.round(h * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.7);
}

export async function videoPoster(file: Blob): Promise<string> {
  const src = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.src = src;
  try {
    await withTimeout(Promise.race([waitVideo(video, "loadedmetadata"), waitVideo(video, "loadeddata")]), 3000, "poster");
    video.currentTime = Math.min(0.2, (video.duration || 1) * 0.05);
    await withTimeout(waitVideo(video, "seeked"), 1500, "poster").catch(() => undefined);
    return grabPosterFromVideo(video);
  } catch {
    return "";
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(src);
  }
}

function guessMime(name: string) {
  if (/\.webm$/i.test(name)) return "video/webm";
  if (/\.mov$/i.test(name)) return "video/quicktime";
  if (/\.m4v$/i.test(name)) return "video/x-m4v";
  return "video/mp4";
}

export function fileVideoMime(file: File) {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  return guessMime(file.name);
}

/**
 * Best-effort light copy. iPhone camera-roll HEVC often won't decode in a
 * hidden <video>, so any failure returns the original file for a direct upload.
 */
export async function shrinkVideo(
  file: File,
  onStatus?: (msg: string) => void,
): Promise<{ blob: Blob; mime: string; poster: string }> {
  const fallback = { blob: file, mime: fileVideoMime(file), poster: "" };
  try {
    onStatus?.("Preparing clip…");
    const transcoded = await tryTranscode(file, onStatus);
    return transcoded;
  } catch {
    onStatus?.("Uploading original…");
    const poster = await videoPoster(file).catch(() => "");
    return { ...fallback, poster };
  }
}

async function tryTranscode(
  file: File,
  onStatus?: (msg: string) => void,
): Promise<{ blob: Blob; mime: string; poster: string }> {
  const src = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "true");
  video.setAttribute("webkit-playsinline", "true");
  video.preload = "metadata";
  video.src = src;
  video.style.cssText = "position:fixed;left:-80px;top:0;width:80px;height:45px;opacity:1;z-index:-1";
  document.body.appendChild(video);

  const cleanup = () => {
    try {
      video.pause();
    } catch {
      /* ignore */
    }
    video.removeAttribute("src");
    video.load();
    video.remove();
    URL.revokeObjectURL(src);
  };

  try {
    await withTimeout(
      Promise.race([waitVideo(video, "loadedmetadata"), waitVideo(video, "loadeddata"), waitVideo(video, "canplay")]),
      2500,
      "skip-transcode",
    );
    const poster = grabPosterFromVideo(video);
    const mime = recorderMime();
    const cap = (video as HTMLVideoElement & { captureStream?: (fps?: number) => MediaStream }).captureStream;
    if (!mime || typeof cap !== "function") {
      return { blob: file, mime: fileVideoMime(file), poster };
    }
    if (file.size <= 2_000_000) {
      return { blob: file, mime: fileVideoMime(file), poster };
    }

    onStatus?.("Preparing clip…");
    video.currentTime = 0;
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 8;
    video.playbackRate = duration > 12 ? 2 : 1.75;
    await video.play().catch(() => undefined);
    const stream = cap.call(video);
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1_200_000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise<Blob>((resolve, reject) => {
      rec.onstop = () => resolve(new Blob(chunks, { type: mime.split(";")[0] }));
      rec.onerror = () => reject(new Error("skip-transcode"));
    });
    rec.start(200);
    const waitMs = Math.min((duration * 1000) / Math.max(video.playbackRate, 1) + 800, 20_000);
    await new Promise((r) => setTimeout(r, waitMs));
    if (rec.state !== "inactive") rec.stop();
    video.pause();
    const blob = await withTimeout(stopped, 3000, "skip-transcode");
    if (blob.size < 400) return { blob: file, mime: fileVideoMime(file), poster };
    return { blob, mime: blob.type || mime.split(";")[0] || "video/mp4", poster };
  } finally {
    cleanup();
  }
}

export function extForMime(mime: string) {
  if (mime.includes("webm")) return "webm";
  if (mime.includes("png")) return "png";
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("quicktime") || mime.includes("mov")) return "mov";
  return "mp4";
}

