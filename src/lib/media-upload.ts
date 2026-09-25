import { compressImage, compressImageBlob } from "@/lib/media";
import { finishMediaParts, putMediaPart } from "@/lib/server/queries";

/**
 * Resize a photo and store it in /api/media so profile rows hold a short URL
 * instead of a base64 blob. If the upload can't happen (signed out, network),
 * fall back to the old inline data URL so the form still works.
 */
export async function uploadPhotoFile(file: File): Promise<string> {
  try {
    const blob = await compressImageBlob(file, 720);
    return await uploadBlob(blob, "image/jpeg");
  } catch {
    return compressImage(file, 720);
  }
}

/** Video posters are captured as data URLs; store them as files when possible. */
export async function uploadPosterDataUrl(dataUrl: string): Promise<string> {
  try {
    const blob = await (await fetch(dataUrl)).blob();
    return await uploadBlob(blob, "image/jpeg");
  } catch {
    return dataUrl;
  }
}

async function sliceToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const step = 0x8000;
  for (let j = 0; j < buf.length; j += step) {
    binary += String.fromCharCode(...buf.subarray(j, j + step));
  }
  return btoa(binary);
}

export async function uploadBlob(blob: Blob, mime: string, onStatus?: (s: string) => void): Promise<string> {
  if (blob.size < 32) throw new Error("That file was empty.");
  if (blob.size > 80 * 1024 * 1024) {
    throw new Error("Clip is over 80 MB. Trim it in Photos and try again.");
  }
  const SIZE = 120_000;
  const total = Math.max(1, Math.ceil(blob.size / SIZE));
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  let finished = 0;

  async function sendPart(index: number, attempt = 0): Promise<void> {
    const start = index * SIZE;
    const end = Math.min(blob.size, start + SIZE);
    const chunk = await sliceToBase64(blob.slice(start, end));
    try {
      await putMediaPart({ data: { id, index, total, chunk, mime } });
    } catch (err) {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        return sendPart(index, attempt + 1);
      }
      throw err;
    }
    finished += 1;
    onStatus?.(`Saving ${Math.round((finished / total) * 100)}%`);
  }

  const concurrency = 2;
  for (let i = 0; i < total; i += concurrency) {
    const batch: Promise<void>[] = [];
    for (let j = i; j < Math.min(total, i + concurrency); j += 1) batch.push(sendPart(j));
    await Promise.all(batch);
  }

  onStatus?.("Finishing…");
  const res = await finishMediaParts({ data: { id, total, mime } });
  if (!res.url) throw new Error("Upload did not finish.");
  return res.url;
}
