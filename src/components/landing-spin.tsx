export function LandingSpin() {
  return (
    <div className="relative h-40 w-full max-w-full overflow-hidden bg-[#050505]">
      <img
        src="/videos/chrome-mittwork.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-contain"
      />
      <img
        src="/videos/chrome-spin.webp"
        alt=""
        className="relative h-full w-full object-contain"
      />
    </div>
  );
}
