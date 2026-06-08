import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/AppShell";
import { PremiumBanner } from "@/components/DemoLock";

export const Route = createFileRoute("/magazzino")({ component: MagazzinoPage });

function MagazzinoPage() {
  const rows = [
    { name: "Mozzarella di Bufala", lot: "LOT-26-001", qty: "12 kg", exp: "10/06/26" },
    { name: "Ricotta di Pecora", lot: "LOT-26-002", qty: "6 kg", exp: "12/06/26" },
    { name: "Caciocavallo Silano", lot: "LOT-26-003", qty: "4 kg", exp: "30/07/26" },
    { name: "Burrata Pugliese", lot: "LOT-26-004", qty: "8 pz", exp: "09/06/26" },
    { name: "Pecorino Stagionato", lot: "LOT-26-005", qty: "3 kg", exp: "31/12/26" },
  ];
  return (
    <div>
      <TopBar title="Magazzino" subtitle="Inventario, lotti, scadenze e fornitori" />
      <div className="p-4 md:p-6 space-y-4">
        <PremiumBanner
          title="Funzionalità disponibile nel Piano Starter"
          text="Per gestire magazzino, lotti, scadenze e fornitori attiva il Piano Starter."
        />
        <div className="opacity-40 pointer-events-none select-none space-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="bg-card rounded-xl p-3 flex items-center gap-3 border border-border">
              <div className="flex-1 min-w-0">
                <p className="font-display text-sm text-brand-green truncate">{r.name}</p>
                <p className="text-[11px] text-muted-foreground">Lotto {r.lot} · scad. {r.exp}</p>
              </div>
              <p className="font-display text-lg text-brand-green">{r.qty}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
