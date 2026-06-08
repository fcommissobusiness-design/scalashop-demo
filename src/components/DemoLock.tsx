import { useEffect, useState } from "react";

/**
 * Global demo-lock modal. Show by calling `openDemoLock(feature)`.
 * The modal is mounted once at the AppShell root.
 */

const EVT = "scalashop-demo-lock";

export function openDemoLock(feature?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVT, { detail: { feature } }));
}

export function DemoLockModal() {
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string | undefined>();

  useEffect(() => {
    const h = (e: Event) => {
      const ce = e as CustomEvent<{ feature?: string }>;
      setFeature(ce.detail?.feature);
      setOpen(true);
    };
    window.addEventListener(EVT, h);
    return () => window.removeEventListener(EVT, h);
  }, []);

  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-[200] flex items-center justify-center p-4"
      onClick={() => setOpen(false)}>
      <div className="bg-brand-cream rounded-2xl max-w-sm w-full p-6 shadow-2xl border-2 border-brand-gold/50 text-center"
        onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto w-12 h-12 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-2xl mb-3">🔒</div>
        <h3 className="font-display text-xl text-brand-green mb-1">Funzionalità non disponibile nella demo</h3>
        {feature && <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">{feature}</p>}
        <p className="text-sm text-foreground/80 mb-4">
          Per sbloccare questa funzionalità attiva il Piano Starter di ScalaShop.
        </p>
        <button onClick={() => setOpen(false)}
          className="w-full px-5 py-3 rounded-xl bg-brand-gold text-white text-sm font-semibold shadow hover:brightness-105 transition">
          Attiva il Piano Starter
        </button>
        <button onClick={() => setOpen(false)}
          className="mt-2 text-xs text-muted-foreground underline">Chiudi</button>
      </div>
    </div>
  );
}

/** Inline overlay banner for boxes that should appear visible-but-locked. */
export function DemoLockOverlay({ feature, compact }: { feature?: string; compact?: boolean }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center p-2 bg-brand-cream/70 backdrop-blur-[2px] rounded-xl">
      <div className={`bg-brand-cream border-2 border-brand-gold/50 rounded-xl shadow-lg text-center ${compact ? "p-3 max-w-[240px]" : "p-4 max-w-xs"}`}>
        <div className="mx-auto w-8 h-8 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-base mb-1">🔒</div>
        <p className={`font-display text-brand-green ${compact ? "text-sm" : "text-base"} leading-tight`}>
          Funzionalità non disponibile nella demo
        </p>
        {feature && <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{feature}</p>}
        <p className={`text-foreground/75 mt-1 ${compact ? "text-[11px]" : "text-xs"}`}>
          Per sbloccare attiva il Piano Starter di ScalaShop.
        </p>
        <button type="button" onClick={(e) => e.preventDefault()}
          className={`mt-2 inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-brand-gold text-white font-semibold ${compact ? "text-[11px]" : "text-xs"}`}>
          Attiva il Piano Starter
        </button>
      </div>
    </div>
  );
}

/** Inline static banner (non-overlay). Use under section titles to mark them premium. */
export function PremiumBanner({ title, text }: { title?: string; text?: string }) {
  return (
    <div className="bg-brand-cream border-2 border-brand-gold/40 rounded-xl p-4 shadow-sm text-center">
      <div className="mx-auto w-9 h-9 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-lg mb-1">🔒</div>
      <p className="font-display text-brand-green text-base leading-tight">
        {title ?? "Funzionalità disponibile nel Piano Starter"}
      </p>
      {text && <p className="text-xs text-foreground/75 mt-1">{text}</p>}
      <button type="button" onClick={() => openDemoLock(title)}
        className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-brand-gold text-white text-xs font-semibold">
        Attiva il Piano Starter
      </button>
    </div>
  );
}