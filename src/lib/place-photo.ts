export function tileXY(lat: number, lng: number, zoom = 18) {
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n,
  );
  return { z: zoom, x, y };
}

export function aerialPhoto(lat: number, lng: number) {
  const { z, x, y } = tileXY(lat, lng, 18);
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
}

export function placeThumbUrl(lat: number, lng: number) {
  return `/api/place-thumb?lat=${Number(lat).toFixed(5)}&lng=${Number(lng).toFixed(5)}`;
}

export function isStockGymPhoto(url: string | null | undefined) {
  if (!url) return true;
  return !url.startsWith("http") || /\/photos\/(gyms|styles)\//.test(url);
}
