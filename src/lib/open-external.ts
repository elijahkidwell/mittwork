/** Open Stripe (or any bank/connect page) outside the app iframe / WebView. */
export function openExternal(url: string) {
  if (!url) return;
  try {
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (opened) return;
  } catch {
    /* popup blocked */
  }
  try {
    if (window.top && window.top !== window) {
      window.top.location.href = url;
      return;
    }
  } catch {
    /* cross-origin frame */
  }
  window.location.assign(url);
}
