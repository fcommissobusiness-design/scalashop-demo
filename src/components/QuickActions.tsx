import { useState } from "react";
import { copyText, telUrl, mapsUrl, normalizePhone } from "@/lib/whatsapp";

export function CopyBtn({ text, label = "Copia", className }: { text: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  if (!text) return null;
  return (
    <button
      onClick={async (e) => {
        e.stopPropagation();
        const ok = await copyText(text);
        if (ok) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        }
      }}
      className={className ?? "text-[11px] bg-card border border-border rounded-lg px-2 py-1 font-semibold text-foreground/70"}
    >
      {done ? "Copiato ✓" : label}
    </button>
  );
}

export function CallBtn({ phone, className }: { phone?: string; className?: string }) {
  if (!phone || normalizePhone(phone).length < 8) return null;
  return (
    <a
      href={telUrl(phone)}
      onClick={(e) => e.stopPropagation()}
      className={className ?? "text-xs bg-brand-green text-brand-cream rounded-lg px-2 py-1.5 font-semibold"}
    >
      Chiama
    </a>
  );
}

export function MapsBtn({ address, className }: { address?: string; className?: string }) {
  if (!address?.trim()) return null;
  return (
    <a
      href={mapsUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={className ?? "text-xs bg-blue-600 text-white rounded-lg px-2 py-1.5 font-semibold"}
    >
      Maps
    </a>
  );
}
