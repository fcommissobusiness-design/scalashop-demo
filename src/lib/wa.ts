/* Central WhatsApp redirect helper for all premium CTAs. */
export const WA_NUMBER = "393883810008";
export const WA_URL = `https://wa.me/${WA_NUMBER}`;

export function openWA(text?: string) {
  if (typeof window === "undefined") return;
  const url = text ? `${WA_URL}?text=${encodeURIComponent(text)}` : WA_URL;
  window.open(url, "_blank", "noopener,noreferrer");
}