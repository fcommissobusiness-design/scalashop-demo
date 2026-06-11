import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useStore } from "@/lib/store";
import { patchDemoMeta } from "@/lib/store";
import logoAsset from "@/assets/scalashop-logo.png.asset.json";
import {
  parseClientsText, parseProductsText, toClient, toProduct, extractFromFile,
  type ParsedClient, type ParsedProduct,
} from "@/lib/demo-parsers";
import { ocrExtract } from "@/lib/ocr.functions";

const ONB_KEY = "scalashop-onboarding";
export type OnbData = {
  businessName: string;
  businessType: string;
  businessTypeOther?: string;
  takesOrders: "si" | "no";
  orderChannels?: string[];
  orderChannelsOther?: string;
  doesDelivery: "si" | "no";
  productsCount: string;
  hasClientsList: "si" | "no";
  importedClients: number;
  importedProducts: number;
  completedAt: string;
};

export function hasCompletedOnboarding(userId: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(`${ONB_KEY}:${userId}`);
    return !!raw && !!JSON.parse(raw)?.completedAt;
  } catch { return false; }
}

const BUSINESS_TYPES = ["Gastronomia", "Caseificio", "Salumeria", "Alimentari", "Bottega food", "Altro"];
const PRODUCTS_RANGES = ["Meno di 20", "20–50", "50–150", "Oltre 150"];
const ORDER_CHANNELS = ["WhatsApp", "Telefono", "Sito", "Email", "Instagram/Facebook", "Di persona", "Altro"];

export function OnboardingScreen({ userId, onDone }: { userId: string; onDone: () => void }) {
  const { addClient, addProduct } = useStore();
  const runOcr = useServerFn(ocrExtract);

  // Pre-popola dati registrazione (nome attività) se disponibili.
  const reg = (() => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(`scalashop-reg:${userId}`) : null;
      return raw ? (JSON.parse(raw) as { businessName?: string; phone?: string }) : null;
    } catch { return null; }
  })();

  // Attività
  const [businessName, setBusinessName] = useState(reg?.businessName ?? "");
  const [businessType, setBusinessType] = useState("");
  const [businessTypeOther, setBusinessTypeOther] = useState("");

  // Ordini
  const [takesOrders, setTakesOrders] = useState<"si" | "no" | "">("");
  const [orderChannels, setOrderChannels] = useState<string[]>([]);
  const [orderChannelsOther, setOrderChannelsOther] = useState("");

  // Consegne
  const [doesDelivery, setDoesDelivery] = useState<"si" | "no" | "">("");

  // Prodotti
  const [productsCount, setProductsCount] = useState("");
  const [productsText, setProductsText] = useState("");
  const [productsMsg, setProductsMsg] = useState<string | null>(null);
  const [productsParsing, setProductsParsing] = useState(false);
  const productsFileRef = useRef<HTMLInputElement>(null);

  // Clienti
  const [hasClientsList, setHasClientsList] = useState<"si" | "no" | "">("");
  const [clientsText, setClientsText] = useState("");
  const [clientsMsg, setClientsMsg] = useState<string | null>(null);
  const clientsFileRef = useRef<HTMLInputElement>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [submitErr, setSubmitErr] = useState<string | null>(null);

  // Refs per scrollare al primo campo mancante
  const refs = {
    businessName: useRef<HTMLDivElement>(null),
    businessType: useRef<HTMLDivElement>(null),
    businessTypeOther: useRef<HTMLDivElement>(null),
    takesOrders: useRef<HTMLDivElement>(null),
    orderChannels: useRef<HTMLDivElement>(null),
    doesDelivery: useRef<HTMLDivElement>(null),
    productsCount: useRef<HTMLDivElement>(null),
    hasClientsList: useRef<HTMLDivElement>(null),
  } as const;

  const toggleChannel = (c: string) =>
    setOrderChannels(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const validate = (): string[] => {
    const missing: string[] = [];
    if (businessName.trim().length < 2) missing.push("businessName");
    if (!businessType) missing.push("businessType");
    if (businessType === "Altro" && businessTypeOther.trim().length < 2) missing.push("businessTypeOther");
    if (!takesOrders) missing.push("takesOrders");
    if (takesOrders === "si" && orderChannels.length === 0) missing.push("orderChannels");
    if (!doesDelivery) missing.push("doesDelivery");
    if (!productsCount) missing.push("productsCount");
    if (!hasClientsList) missing.push("hasClientsList");
    return missing;
  };

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const s = String(r.result || "");
        const idx = s.indexOf("base64,");
        resolve(idx >= 0 ? s.slice(idx + 7) : s);
      };
      r.onerror = () => reject(r.error);
      r.readAsDataURL(f);
    });

  // ---- File handlers ----
  const onClientsFile = async (f: File) => {
    setClientsMsg("Lettura file…");
    try {
      const res = await extractFromFile(f);
      if (res.kind === "image") {
        setClientsMsg("Lettura immagine in corso…");
        const base64 = await fileToBase64(f);
        const out = await runOcr({ data: { base64, mime: f.type || "image/jpeg", kind: "clients" } });
        if (!out?.ok || !out.text?.trim()) {
          setClientsMsg("Impossibile leggere l'immagine. Incolla l'elenco qui sotto.");
          return;
        }
        setClientsText(prev => prev ? prev + "\n" + out.text : out.text);
        const parsed = parseClientsText(out.text);
        setClientsMsg(`Rilevati ${parsed.length} clienti — verranno creati al termine.`);
        return;
      }
      if (!res.text.trim()) { setClientsMsg("File vuoto o non leggibile."); return; }
      setClientsText(prev => prev ? prev + "\n" + res.text : res.text);
      const parsed = parseClientsText(res.text);
      setClientsMsg(`Rilevati ${parsed.length} clienti — verranno creati al termine.`);
    } catch {
      setClientsMsg("Impossibile leggere il file. Prova a incollare il testo qui sotto.");
    }
  };

  const onProductsFile = async (f: File) => {
    setProductsMsg("Lettura file…");
    setProductsParsing(true);
    try {
      const res = await extractFromFile(f);
      if (res.kind === "image") {
        setProductsMsg("Lettura immagine in corso…");
        const base64 = await fileToBase64(f);
        const out = await runOcr({ data: { base64, mime: f.type || "image/jpeg", kind: "products" } });
        if (!out?.ok || !out.text?.trim()) {
          setProductsMsg("Impossibile leggere l'immagine. Incolla il listino qui sotto.");
          return;
        }
        setProductsText(prev => prev ? prev + "\n" + out.text : out.text);
        const parsed = parseProductsText(out.text);
        setProductsMsg(`Rilevati ${parsed.length} prodotti — verranno creati al termine.`);
        return;
      }
      if (!res.text.trim()) { setProductsMsg("File vuoto o non leggibile."); return; }
      setProductsText(prev => prev ? prev + "\n" + res.text : res.text);
      const parsed = parseProductsText(res.text);
      setProductsMsg(`Rilevati ${parsed.length} prodotti — verranno creati al termine.`);
    } catch {
      setProductsMsg("Impossibile leggere il file. Prova a incollare il listino qui sotto.");
    } finally {
      setProductsParsing(false);
    }
  };

  // ---- Drag & drop handlers ----
  const makeDragHandlers = (onFile: (f: File) => void | Promise<void>) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); },
    onDragEnter: (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault(); e.stopPropagation();
      const f = e.dataTransfer?.files?.[0];
      if (f) onFile(f);
    },
  });

  // ---- Submit ----
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const missing = validate();
    if (missing.length) {
      const map: Record<string, boolean> = {};
      missing.forEach(k => (map[k] = true));
      setErrors(map);
      setSubmitErr("Compila tutti i campi obbligatori");
      const firstKey = missing[0] as keyof typeof refs;
      const el = refs[firstKey]?.current;
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    setSubmitErr(null);
    setSubmitting(true);

    // Parse e crea clienti / prodotti
    let createdClients = 0;
    let createdProducts = 0;

    if (hasClientsList === "si" && clientsText.trim()) {
      const parsed: ParsedClient[] = parseClientsText(clientsText);
      for (const c of parsed) {
        try { addClient(toClient(c)); createdClients++; } catch {}
      }
    }
    if (productsText.trim()) {
      const parsed: ParsedProduct[] = parseProductsText(productsText);
      for (const p of parsed) {
        try { addProduct(toProduct(p)); createdProducts++; } catch {}
      }
    }

    const data: OnbData = {
      businessName: businessName.trim(),
      businessType,
      businessTypeOther: businessType === "Altro" ? businessTypeOther.trim() : undefined,
      takesOrders: takesOrders as "si" | "no",
      orderChannels: takesOrders === "si" ? orderChannels : undefined,
      orderChannelsOther: orderChannels.includes("Altro") ? orderChannelsOther.trim() : undefined,
      doesDelivery: doesDelivery as "si" | "no",
      productsCount,
      hasClientsList: hasClientsList as "si" | "no",
      importedClients: createdClients,
      importedProducts: createdProducts,
      completedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(`${ONB_KEY}:${userId}`, JSON.stringify(data)); } catch {}
    // Mirror onboarding nel cloud (user_state) per il monitoraggio admin.
    try { patchDemoMeta({ onboarding: data }); } catch {}
    onDone();
  };

  return (
    <div className="min-h-screen bg-brand-cream text-brand-green flex items-start md:items-center justify-center px-4 py-6 md:py-10">
      <form onSubmit={submit} className="w-full max-w-2xl space-y-6">
        {/* Header con logo */}
        <div className="flex flex-col items-center text-center">
          <img src={logoAsset.url} alt="ScalaShop" className="h-24 md:h-28 object-contain" />
          <p className="text-sm text-muted-foreground mt-2 max-w-md">
            Configura la tua demo in 4 passaggi rapidi. Puoi modificare tutto in seguito dal gestionale.
          </p>
        </div>

        {/* Blocco 1 — Attività */}
        <Block title="1. Attività" subtitle="Come si chiama e che tipo di attività hai">
          <div ref={refs.businessName}>
            <LabeledInput label="Nome attività" placeholder="Es. Bottega del Borgo"
              value={businessName} onChange={setBusinessName} error={errors.businessName} />
          </div>
          <div ref={refs.businessType}>
            <Label>Tipologia attività</Label>
            <ChipGroup options={BUSINESS_TYPES} value={businessType} onChange={setBusinessType} error={errors.businessType} />
            {businessType === "Altro" && (
              <div ref={refs.businessTypeOther}>
                <input value={businessTypeOther} onChange={e => setBusinessTypeOther(e.target.value)}
                  placeholder="Scrivi la tipologia della tua attività"
                  className={`w-full mt-2 px-3 py-2.5 rounded-lg bg-white border text-brand-green outline-none focus:border-brand-gold ${errors.businessTypeOther ? "border-red-500" : "border-border"}`} />
              </div>
            )}
          </div>
        </Block>

        {/* Blocco 2 — Ordini e consegne */}
        <Block title="2. Ordini e consegne" subtitle="Come ricevi gli ordini dai tuoi clienti">
          <div ref={refs.takesOrders}>
            <Label>Prendi ordinazioni o prenotazioni dai tuoi clienti?</Label>
            <YesNo value={takesOrders} onChange={(v) => { setTakesOrders(v); if (v === "no") setOrderChannels([]); }} error={errors.takesOrders} />
          </div>
          {takesOrders === "si" && (
            <div ref={refs.orderChannels}>
              <Label>Da quali canali le ricevi? <span className="opacity-60 normal-case font-normal">(seleziona più opzioni)</span></Label>
              <ChipGroup options={ORDER_CHANNELS} value={orderChannels} onChange={toggleChannel} multi error={errors.orderChannels} />
              {orderChannels.includes("Altro") && (
                <input value={orderChannelsOther} onChange={e => setOrderChannelsOther(e.target.value)}
                  placeholder="Scrivi gli altri canali"
                  className="w-full mt-2 px-3 py-2.5 rounded-lg bg-white border border-border text-brand-green outline-none focus:border-brand-gold" />
              )}
            </div>
          )}
          <div ref={refs.doesDelivery}>
            <Label>Fai anche consegne a domicilio?</Label>
            <YesNo value={doesDelivery} onChange={setDoesDelivery} error={errors.doesDelivery} />
          </div>
        </Block>

        {/* Blocco 3 — Prodotti */}
        <Block title="3. Prodotti" subtitle="Quanti prodotti gestisci e (opzionale) carica il tuo listino">
          <div ref={refs.productsCount}>
            <Label>Numero indicativo di prodotti gestiti</Label>
            <ChipGroup options={PRODUCTS_RANGES} value={productsCount} onChange={setProductsCount} error={errors.productsCount} />
          </div>
          <div>
            <Label>Carica il tuo listino prodotti <span className="opacity-60 normal-case font-normal">(opzionale)</span></Label>
            <p className="text-xs text-muted-foreground mb-2">
              CSV, XLSX, PDF, JPG/PNG: carica, trascina o incolla. Per le immagini, copia/incolla il testo qui sotto.
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              <button type="button" onClick={() => productsFileRef.current?.click()}
                className="px-3 py-2 rounded-lg bg-white border border-border text-sm font-medium hover:border-brand-gold">
                {productsParsing ? "Lettura…" : "Carica file (CSV, XLSX, PDF, JPG, PNG)"}
              </button>
              <input ref={productsFileRef} type="file"
                accept=".csv,.txt,.pdf,.xlsx,.xls,.jpg,.jpeg,.png,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/jpeg,image/png"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onProductsFile(f); e.target.value = ""; }} />
            </div>
            <textarea value={productsText} onChange={e => setProductsText(e.target.value)}
              {...makeDragHandlers(onProductsFile)}
              placeholder={"Trascina qui un file o incolla il listino, una riga per prodotto.\nEs.\nMozzarella di bufala  14,50 kg\nRicotta  1,50 pz\nPane casareccio  3,00 kg"}
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-white border border-dashed border-brand-gold/40 text-sm text-brand-green outline-none focus:border-brand-gold resize-none overflow-auto font-mono"
              style={{ height: "180px" }} />
            {productsMsg && <p className="text-xs text-muted-foreground mt-1">{productsMsg}</p>}
          </div>
        </Block>

        {/* Blocco 4 — Clienti */}
        <Block title="4. Clienti" subtitle="Hai già un elenco dei tuoi clienti abituali?">
          <div ref={refs.hasClientsList}>
            <Label>Hai un elenco dei tuoi clienti abituali con nome e/o numero di telefono?</Label>
            <YesNo value={hasClientsList} onChange={(v) => { setHasClientsList(v); if (v === "no") { setClientsText(""); setClientsMsg(null); } }} error={errors.hasClientsList} />
          </div>
          {hasClientsList === "si" && (
            <div>
              <Label>Incolla, trascina o carica l'elenco dei tuoi clienti <span className="opacity-60 normal-case font-normal">(CSV, XLSX, PDF, JPG, PNG)</span></Label>
              <div className="flex flex-wrap gap-2 mb-2">
                <button type="button" onClick={() => clientsFileRef.current?.click()}
                  className="px-3 py-2 rounded-lg bg-white border border-border text-sm font-medium hover:border-brand-gold">
                  Carica file
                </button>
                <input ref={clientsFileRef} type="file"
                  accept=".csv,.txt,.pdf,.xlsx,.xls,.jpg,.jpeg,.png,text/csv,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) onClientsFile(f); e.target.value = ""; }} />
              </div>
              <textarea value={clientsText} onChange={e => setClientsText(e.target.value)}
                {...makeDragHandlers(onClientsFile)}
                placeholder={"Trascina qui un file o incolla l'elenco.\nEs.\nMario Rossi  3331234567\nLucia Bianchi  3399876543\nGiuseppe Verdi"}
                rows={6}
                className="w-full px-3 py-2 rounded-lg bg-white border border-dashed border-brand-gold/40 text-sm text-brand-green outline-none focus:border-brand-gold resize-none overflow-auto font-mono"
                style={{ height: "180px" }} />
              {clientsMsg && <p className="text-xs text-muted-foreground mt-1">{clientsMsg}</p>}
            </div>
          )}
        </Block>

        <button type="submit" disabled={submitting}
          className="w-full py-3.5 rounded-xl bg-brand-gold text-white font-semibold text-base shadow-sm hover:brightness-105 disabled:opacity-50 disabled:cursor-not-allowed transition">
          {submitting ? "Configurazione in corso…" : "Inizia la demo"}
        </button>
        {submitErr && (
          <p className="text-sm font-semibold text-red-600 text-center -mt-3">{submitErr}</p>
        )}
        <p className="text-[11px] text-muted-foreground text-center">
          Potrai aggiungere o modificare clienti, prodotti e impostazioni in qualsiasi momento.
        </p>
      </form>
    </div>
  );
}

/* ============ UI helpers (locali) ============ */
function Block({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white border border-border rounded-2xl p-5 md:p-6 space-y-4 shadow-sm">
      <div>
        <h2 className="font-display text-lg md:text-xl text-brand-green">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{children}</p>;
}
function LabeledInput({ label, placeholder, value, onChange, error }: { label: string; placeholder?: string; value: string; onChange: (v: string) => void; error?: boolean }) {
  return (
    <div>
      <Label>{label}</Label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3 py-2.5 rounded-lg bg-white border text-brand-green outline-none focus:border-brand-gold ${error ? "border-red-500" : "border-border"}`} />
    </div>
  );
}
function ChipGroup({ options, value, onChange, multi, error }: { options: string[]; value: string | string[]; onChange: (v: any) => void; multi?: boolean; error?: boolean }) {
  const isActive = (o: string) => multi ? (value as string[]).includes(o) : value === o;
  return (
    <div className={`grid grid-cols-2 md:grid-cols-3 gap-2 ${error ? "p-1 rounded-lg border border-red-500" : ""}`}>
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-3 py-2.5 rounded-lg text-sm font-medium text-left border transition ${isActive(o)
            ? "bg-brand-gold text-white border-brand-gold"
            : "bg-white text-brand-green/90 border-border hover:border-brand-gold/60"}`}>
          {o}
        </button>
      ))}
    </div>
  );
}
function YesNo({ value, onChange, error }: { value: "si" | "no" | ""; onChange: (v: "si" | "no") => void; error?: boolean }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${error ? "p-1 rounded-lg border border-red-500" : ""}`}>
      {(["si", "no"] as const).map(v => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`px-3 py-2.5 rounded-lg text-sm font-semibold border transition ${value === v
            ? "bg-brand-gold text-white border-brand-gold"
            : "bg-white text-brand-green/90 border-border hover:border-brand-gold/60"}`}>
          {v === "si" ? "Sì" : "No"}
        </button>
      ))}
    </div>
  );
}