import { createFileRoute } from "@tanstack/react-router";
import { TopBar } from "@/components/AppShell";
import { TrendingUp, Sun, Cloud } from "lucide-react";

export const Route = createFileRoute("/previsioni-giornaliere")({
  component: PrevisioniGiornalierePage,
});

// Dati fittizi di esempio: storico vendite per prodotto fresco + suggerimento ordine.
const PRODOTTI_DEMO = [
  { nome: "Mozzarella di bufala 250g", iniziale: 40, finale: 6, venduti: 34, suggerito: 36, trend: "+12%" },
  { nome: "Pane fresco kg", iniziale: 25, finale: 3, venduti: 22, suggerito: 24, trend: "+8%" },
  { nome: "Insalata mista busta", iniziale: 30, finale: 9, venduti: 21, suggerito: 22, trend: "-3%" },
  { nome: "Pesce spada trancio", iniziale: 12, finale: 2, venduti: 10, suggerito: 11, trend: "+5%" },
  { nome: "Cornetti vuoti", iniziale: 60, finale: 11, venduti: 49, suggerito: 52, trend: "+10%" },
  { nome: "Yogurt greco 150g", iniziale: 48, finale: 12, venduti: 36, suggerito: 38, trend: "+4%" },
];

const GIORNI = [
  { g: "Lun", v: 142, tipo: "feriale" },
  { g: "Mar", v: 138, tipo: "feriale" },
  { g: "Mer", v: 151, tipo: "feriale" },
  { g: "Gio", v: 147, tipo: "feriale" },
  { g: "Ven", v: 189, tipo: "feriale" },
  { g: "Sab", v: 244, tipo: "festivo" },
  { g: "Dom", v: 221, tipo: "festivo" },
];

function PrevisioniGiornalierePage() {
  const maxV = Math.max(...GIORNI.map(d => d.v));
  return (
    <div>
      <TopBar title="Previsioni Giornaliere" subtitle="Suggerimenti ordini sui freschi" />

      <div className="p-4 md:p-6 space-y-4">
        {/* KPI fittizi */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Ordine consigliato oggi" value="312" sub="unità totali" />
          <Kpi label="Resa media settimana" value="92%" sub="venduto / ordinato" />
          <Kpi label="Sprechi stimati" value="-18%" sub="vs settimana scorsa" />
        </div>

        {/* Grafico storico settimana */}
        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-display text-base text-brand-green">Storico vendite settimana</p>
              <p className="text-xs text-muted-foreground">Suddivisione feriale / festivo</p>
            </div>
            <TrendingUp className="w-5 h-5 text-brand-gold" />
          </div>
          <div className="flex items-end justify-between gap-2 h-32">
            {GIORNI.map(d => (
              <div key={d.g} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t-md flex items-end justify-center"
                  style={{
                    height: `${(d.v / maxV) * 100}%`,
                    background: d.tipo === "festivo" ? "var(--brand-gold, #c8a85a)" : "var(--brand-green, #2e5d3a)",
                  }} />
                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {d.tipo === "festivo" ? <Sun className="w-3 h-3" /> : <Cloud className="w-3 h-3" />}
                  {d.g}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Form fittizio inserimento giornata */}
        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <p className="font-display text-base text-brand-green mb-2">Registra giornata</p>
          <p className="text-xs text-muted-foreground mb-3">
            Inserisci quantità iniziale e finale: l'algoritmo calcola il venduto e
            suggerisce l'ordine per la stessa giornata della settimana successiva.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <FakeInput label="Data" value="Oggi" />
            <FakeInput label="Qtà inizio" value="—" />
            <FakeInput label="Qtà fine" value="—" />
          </div>
        </div>

        {/* Tabella suggerimenti */}
        <div className="bg-card rounded-2xl p-4 shadow-sm">
          <p className="font-display text-base text-brand-green mb-3">Suggerimenti per domani</p>
          <div className="space-y-2">
            {PRODOTTI_DEMO.map(p => (
              <div key={p.nome} className="flex items-center justify-between gap-2 border-b border-border last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.nome}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Inizio {p.iniziale} · fine {p.finale} · venduti {p.venduti}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display text-lg text-brand-green">{p.suggerito}</p>
                  <p className="text-[10px] text-muted-foreground">{p.trend} vs storico</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-card rounded-xl p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-display text-2xl mt-1 text-brand-green">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function FakeInput({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      <div className="bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground/70">{value}</div>
    </div>
  );
}