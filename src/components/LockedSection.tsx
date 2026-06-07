import { TopBar } from "@/components/AppShell";

export function LockedSection({ title }: { title?: string }) {
  return (
    <div>
      <TopBar title={title ?? "Funzionalità Pro"} subtitle="Disponibile con il piano Starter" />
      <div className="relative min-h-[60vh] p-4 md:p-8">
        {/* Fake blurred preview */}
        <div aria-hidden className="absolute inset-4 md:inset-8 rounded-2xl bg-card border border-border opacity-40 blur-[2px] overflow-hidden">
          <div className="p-6 space-y-3">
            <div className="h-6 w-1/3 bg-muted rounded" />
            <div className="h-4 w-2/3 bg-muted rounded" />
            <div className="grid grid-cols-3 gap-3 mt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-xl" />
              ))}
            </div>
          </div>
        </div>

        {/* Banner */}
        <div className="relative z-10 mx-auto max-w-md mt-12 md:mt-20 bg-brand-cream border-2 border-brand-gold/50 rounded-2xl shadow-2xl p-6 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-brand-gold/15 text-brand-gold flex items-center justify-center text-2xl mb-3">🔒</div>
          <h2 className="font-display text-xl md:text-2xl text-brand-green mb-2">
            Funzionalità non disponibile in demo
          </h2>
          <p className="text-sm text-foreground/80">
            Per sbloccare anche questa funzionalità, attiva il piano Starter di ScalaShop.
          </p>
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="mt-5 inline-flex items-center justify-center w-full px-5 py-3 rounded-xl bg-brand-gold text-white text-sm font-semibold shadow hover:brightness-105 transition"
          >
            Attiva il piano Starter
          </button>
          <p className="text-[11px] text-muted-foreground mt-2">
            Con il piano Starter avrai accesso a tutte le sezioni del gestionale.
          </p>
        </div>
      </div>
    </div>
  );
}