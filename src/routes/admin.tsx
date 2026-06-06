import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useRef, useEffect } from "react";
import { useStore, getPin, setPin } from "@/lib/store";
import { TopBar, Sheet, Field } from "@/components/AppShell";
import {
  exportClients, exportOrders, exportProducts, exportDeliveries,
  exportSuppliers, exportCashEntries, exportProductions, exportStock, exportPayments,
  exportFreshLogs, exportUnsold, exportSpecialDays, exportGoodsReceipts,
  downloadFullBackup, validateBackup, applyBackup,
  maybeAutoBackup, getAutoBackupInfo, downloadAutoBackup, deleteAutoBackup,
  getStorageStats,
} from "@/lib/backup";
import { CRM_DEFAULTS, loadCrmSettings, saveCrmSettings, resetCrmSettings, type CrmSettings } from "@/lib/crm-settings";

const APP_VERSION = "0.4.0";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const store = useStore();
  const {
    orders, casualSales, products, clients, deliveries, suppliers,
    cashEntries, productions, supplierPayments, freshLogs, unsoldEntries, specialDays,
    goodsReceipts,
    importJson, reset, storageInfo,
  } = store;
  const [openPin, setOpenPin] = useState(false);
  const [openImport, setOpenImport] = useState(false);
  const [openReset, setOpenReset] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [autoTick, setAutoTick] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { maybeAutoBackup(); }, []);
  const autoInfo = useMemo(() => getAutoBackupInfo(), [autoTick]);
  const storageStats = useMemo(() => getStorageStats(), [autoTick, orders, clients, products]);

  const info = storageInfo();

  const flash = (text: string, ms = 2000) => { setMsg(text); setTimeout(() => setMsg(null), ms); };

  const doExport = () => {
    downloadFullBackup();
    flash("Backup completo esportato.");
  };

  const onFileChosen = async (file: File) => {
    try {
      const text = await file.text();
      const v = validateBackup(text);
      if (!v.ok) throw new Error(v.error);
      if (!confirm(`Confermi il ripristino?\n\nVersione: ${v.backup.version}\nEsportato: ${v.backup.exportedAt}\n\nTutti i dati attuali verranno sostituiti.`)) {
        setOpenImport(false);
        return;
      }
      try { importJson(JSON.stringify(v.backup.data)); } catch { /* fall back */ }
      applyBackup(v.backup);
      setOpenImport(false);
      flash("Backup ripristinato. Ricarico l'app…");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      setOpenImport(false);
      flash("Errore import: " + e.message, 4000);
    }
  };

  const runManualAutoBackup = () => {
    maybeAutoBackup(true);
    setAutoTick((t) => t + 1);
    flash("Backup automatico creato.");
  };

  return (
    <div>
      <TopBar title="Amministrazione" right={
        <button
          onClick={async () => { const { supabase } = await import("@/integrations/supabase/client"); await supabase.auth.signOut(); }}
          className="px-3 py-1.5 rounded-lg bg-brand-cream/10 text-brand-cream text-xs font-semibold hover:bg-brand-cream/20">
          Esci
        </button>
      } />

      <div className="p-4 md:p-6 space-y-6">
        {msg && <div className="bg-success/15 text-success rounded-lg p-3 text-sm">{msg}</div>}

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Manutenzione</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ActionCard title="Cambia PIN" desc="Modifica il codice di accesso a 4 cifre."
              cta="Cambia PIN" onClick={() => setOpenPin(true)} />
            <ActionCard title="Esporta backup JSON" desc="Scarica una copia completa di tutti i dati."
              cta="Esporta" onClick={doExport} />
            <ActionCard title="Importa backup JSON" desc="Sostituisce i dati attuali con quelli del file."
              cta="Importa" onClick={() => setOpenImport(true)} />
            <ActionCard title="Azzera dati" desc="Riporta il gestionale ai dati di esempio. Operazione irreversibile."
              cta="Azzera" danger onClick={() => setOpenReset(true)} />
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Esporta CSV (Excel / Google Sheets)</h2>
          <p className="text-xs text-muted-foreground mb-3">UTF-8 con separatore <code>;</code> (compatibile Excel italiano e Google Sheets). Da consegnare a commercialista o consulenti.</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <CsvBtn label="Clienti" n={clients.length} onClick={() => exportClients(clients)} />
            <CsvBtn label="Ordini" n={orders.length} onClick={() => exportOrders(orders, clients, products)} />
            <CsvBtn label="Prodotti" n={products.length} onClick={() => exportProducts(products, suppliers)} />
            <CsvBtn label="Consegne" n={deliveries.length} onClick={() => exportDeliveries(deliveries, clients)} />
            <CsvBtn label="Fornitori" n={suppliers.length} onClick={() => exportSuppliers(suppliers)} />
            <CsvBtn label="Movimenti finanz." n={cashEntries.length} onClick={() => exportCashEntries(cashEntries)} />
            <CsvBtn label="Produzione" n={productions.length} onClick={() => exportProductions(productions, products)} />
            <CsvBtn label="Magazzino" n={products.filter(p => p.stock !== undefined).length} onClick={() => exportStock(products, suppliers)} />
            <CsvBtn label="Pagamenti" n={supplierPayments.length} onClick={() => exportPayments(supplierPayments, suppliers)} />
            <CsvBtn label="Freschi giorn." n={freshLogs.length} onClick={() => exportFreshLogs(freshLogs, products)} />
            <CsvBtn label="Invenduto" n={unsoldEntries.length} onClick={() => exportUnsold(unsoldEntries, products)} />
            <CsvBtn label="Giorni speciali" n={specialDays.length} onClick={() => exportSpecialDays(specialDays)} />
            <CsvBtn label="Entrate merci" n={goodsReceipts.length} onClick={() => exportGoodsReceipts(goodsReceipts, suppliers, products)} />
          </div>
        </section>

        <CrmSettingsSection onMsg={flash} />

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Backup automatici (settimanali)</h2>
          <div className="bg-card rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <Info label="Backup presenti" value={`${autoInfo.count} / 5`} />
              <Info label="Ultimo backup" value={autoInfo.last ? new Date(autoInfo.last).toLocaleString("it-IT") : "mai"} />
              <Info label="Spazio backup" value={`${autoInfo.totalKb} KB`} />
            </div>
            <div className="flex gap-2">
              <button onClick={runManualAutoBackup}
                className="bg-brand-green text-brand-cream rounded-lg px-3 py-2 text-sm font-semibold">
                Crea backup ora
              </button>
            </div>
            {autoInfo.list.length > 0 && (
              <div className="divide-y divide-border">
                {autoInfo.list.map((b) => (
                  <div key={b.date} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <p className="font-medium">{new Date(b.date).toLocaleString("it-IT")}</p>
                      <p className="text-xs text-muted-foreground">{(b.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => downloadAutoBackup(b.date)}
                        className="text-xs bg-card border border-border rounded px-2 py-1">Scarica</button>
                      <button onClick={() => { deleteAutoBackup(b.date); setAutoTick(t => t + 1); }}
                        className="text-xs text-danger border border-danger/30 rounded px-2 py-1">Elimina</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-display text-lg text-brand-green mb-3">Stato archivio</h2>
          <div className="bg-card rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Info label="Spazio dati" value={`${info.kb} KB`} />
            <Info label="Spazio totale localStorage" value={`${storageStats.totalKb} KB`} />
            <Info label="Versione app" value={APP_VERSION} />
            <Info label="Prodotti" value={info.counts.products.toString()} />
            <Info label="Clienti" value={info.counts.clients.toString()} />
            <Info label="Ordini" value={info.counts.orders.toString()} />
            <Info label="Bundle" value={info.counts.bundles.toString()} />
            <Info label="Scontrini" value={info.counts.casualSales.toString()} />
            <Info label="Consegne" value={info.counts.deliveries.toString()} />
            <Info label="Fornitori" value={info.counts.suppliers.toString()} />
            <Info label="Movimenti" value={info.counts.cashEntries.toString()} />
            <Info label="Pagamenti" value={info.counts.supplierPayments.toString()} />
          </div>
          {storageStats.totalKb > 4000 && (
            <p className="text-xs text-warning mt-2">
              ⚠ Storage elevato ({storageStats.totalKb} KB). Esporta un backup ed elimina backup automatici vecchi se necessario.
            </p>
          )}
        </section>


        <p className="text-xs text-muted-foreground italic">
          Proiezione lineare: <code>(fatturato_progressivo / giorni_trascorsi) × giorni_totali_mese</code>.
          Non sostituisce un commercialista.
        </p>
      </div>

      {openPin && <PinChangeSheet onClose={() => setOpenPin(false)} onDone={() => { setOpenPin(false); setMsg("PIN aggiornato."); setTimeout(() => setMsg(null), 2000); }} />}

      {openImport && (
        <Sheet open={true} onClose={() => setOpenImport(false)} title="Importa backup JSON">
          <p className="text-sm">Seleziona un file di backup. Tutti i dati attuali verranno <strong className="text-danger">sostituiti</strong>.</p>
          <input ref={fileRef} type="file" accept=".json,application/json"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChosen(f); }}
            className="w-full bg-card border border-border rounded-lg p-3 text-sm" />
        </Sheet>
      )}

      {openReset && (
        <Sheet open={true} onClose={() => setOpenReset(false)} title="Azzera dati"
          footer={
            <div className="flex gap-2">
              <button onClick={() => setOpenReset(false)} className="flex-1 bg-card border border-border rounded-xl py-3 font-semibold">Annulla</button>
              <button onClick={() => {
                if (confirm("Sicuro? Tutti i dati verranno cancellati e ripristinati dai dati di esempio.")) {
                  reset(); setOpenReset(false); setMsg("Dati ripristinati."); setTimeout(() => setMsg(null), 2000);
                }
              }}
                className="flex-1 bg-danger text-white rounded-xl py-3 font-semibold">Conferma reset</button>
            </div>
          }>
          <p className="text-sm">Verranno eliminati tutti i dati locali (ordini, clienti, scontrini, consegne, prodotti modificati, bundle modificati) e ripristinati ai dati di esempio.</p>
          <p className="text-sm text-warning font-semibold">Operazione irreversibile. Esporta prima un backup!</p>
        </Sheet>
      )}
    </div>
  );
}

function PinChangeSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    if (oldPin !== getPin()) return setErr("PIN attuale errato");
    if (!/^\d{4}$/.test(newPin)) return setErr("Il nuovo PIN deve essere di 4 cifre");
    if (newPin !== confirm) return setErr("Conferma non corrispondente");
    try { setPin(newPin); onDone(); } catch (e: any) { setErr(e.message); }
  };

  return (
    <Sheet open={true} onClose={onClose} title="Cambia PIN"
      footer={<button onClick={submit} className="w-full bg-brand-gold text-white rounded-xl py-3 font-semibold">Conferma nuovo PIN</button>}
    >
      <Field label="PIN attuale">
        <input type="password" inputMode="numeric" maxLength={4} value={oldPin} onChange={(e) => setOldPin(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3 text-center text-xl tracking-widest" />
      </Field>
      <Field label="Nuovo PIN (4 cifre)">
        <input type="password" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3 text-center text-xl tracking-widest" />
      </Field>
      <Field label="Conferma nuovo PIN">
        <input type="password" inputMode="numeric" maxLength={4} value={confirm} onChange={(e) => setConfirm(e.target.value)}
          className="w-full bg-card border border-border rounded-lg p-3 text-center text-xl tracking-widest" />
      </Field>
      {err && <p className="text-sm text-danger">{err}</p>}
    </Sheet>
  );
}

function ActionCard({ title, desc, cta, onClick, danger }: { title: string; desc: string; cta: string; onClick: () => void; danger?: boolean }) {
  return (
    <div className="bg-card rounded-xl p-4 flex flex-col">
      <h3 className="font-display text-base text-brand-green">{title}</h3>
      <p className="text-xs text-muted-foreground mt-1 flex-1">{desc}</p>
      <button onClick={onClick}
        className={`mt-3 rounded-lg py-2 text-sm font-semibold ${danger ? "bg-danger text-white" : "bg-brand-green text-brand-cream"}`}>{cta}</button>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="font-display text-lg text-brand-green">{value}</p>
    </div>
  );
}


function CsvBtn({ label, n, onClick }: { label: string; n: number; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 text-left hover:bg-accent transition-colors">
      <p className="text-sm font-semibold text-brand-green">{label}</p>
      <p className="text-xs text-muted-foreground">{n} record</p>
    </button>
  );
}

function CrmSettingsSection({ onMsg }: { onMsg: (m: string) => void }) {
  const { runCrmAuto } = useStore();
  const [s, setS] = useState<CrmSettings>(() => loadCrmSettings());
  const set = <K extends keyof CrmSettings>(k: K, v: number) => setS((p) => ({ ...p, [k]: v }));

  const num = (k: keyof CrmSettings, label: string, sub?: string) => (
    <Field label={label}>
      <input type="number" min={0} step={k.includes("Freq") ? 0.1 : 1}
        value={s[k]} onChange={(e) => set(k, +e.target.value)}
        className="w-full bg-card border border-border rounded-lg p-2 text-sm" />
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </Field>
  );

  const save = () => { saveCrmSettings(s); onMsg("Configurazione CRM salvata."); };
  const recompute = async () => {
    saveCrmSettings(s);
    const n = await runCrmAuto();
    onMsg(n > 0 ? `${n} segmento/i aggiornato/i.` : "Nessuna modifica necessaria.");
  };
  const reset = () => { resetCrmSettings(); setS(CRM_DEFAULTS); onMsg("Soglie ripristinate ai default."); };

  return (
    <section>
      <h2 className="font-display text-lg text-brand-green mb-3">CRM — segmentazione automatica</h2>
      <div className="bg-card rounded-xl p-4 space-y-4">
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Upgrade</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {num("newDays", "Giorni \"nuovo\"", "dal primo ordine")}
            {num("abitualiMinFreq", "Abituali ≥ freq", "ordini/mese")}
            {num("topMinLTV", "Top ≥ LTV", "EUR speso lifetime")}
            {num("topMinFreq", "Top ≥ freq", "ordini/mese alt.")}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Downgrade per inattività (giorni dall'ultimo ordine)</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {num("inactiveTopDays", "Top → Abituali")}
            {num("inactiveAbitualiDays", "Abituali → Occas.")}
            {num("inactiveOccDays", "Occas. → Inattivi")}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase text-muted-foreground mb-2 font-semibold">Clienti recuperabili</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {num("recoverableMinDays", "Inattività min", "giorni")}
            {num("recoverableMaxDays", "Inattività max", "giorni")}
            {num("recoverableMinLTV", "LTV minimo", "EUR")}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <button onClick={save} className="bg-brand-green text-brand-cream rounded-lg px-3 py-2 text-sm font-semibold">Salva</button>
          <button onClick={recompute} className="bg-brand-gold text-white rounded-lg px-3 py-2 text-sm font-semibold">Salva e ricalcola subito</button>
          <button onClick={reset} className="bg-card border border-border rounded-lg px-3 py-2 text-sm">Ripristina default</button>
        </div>
        <p className="text-[11px] text-muted-foreground italic">
          La segmentazione gira automaticamente all'apertura dell'app. Non sovrascrive clienti con segmento marcato come <strong>manuale</strong>. Ogni cambio è tracciato nella timeline del cliente.
        </p>
      </div>
    </section>
  );
}

