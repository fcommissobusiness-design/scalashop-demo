// CSV export + JSON backup + auto-backup utilities
import type {
  Product, Client, Order, Delivery, Supplier, CashEntry,
  Production, SupplierPayment, B2BClient, CasualSale, Bundle,
  FreshLog, UnsoldEntry, SpecialDay, GoodsReceipt,
} from "./data";
import { UNSOLD_DESTINATION_LABEL, GOODS_RECEIPT_STATUS_LABEL, INVOICE_STATUS_LABEL, calcReceiptTotal } from "./data";

const SEP = ";"; // Italian Excel-friendly separator
const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility

function escapeCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (Array.isArray(v)) s = v.join("|");
  else if (typeof v === "object") s = JSON.stringify(v);
  if (s.includes(SEP) || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    s = '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (rows.length === 0 && !headers) return BOM;
  const cols = headers ?? Object.keys(rows[0] ?? {});
  const head = cols.join(SEP);
  const body = rows.map((r) => cols.map((c) => escapeCsv(r[c])).join(SEP)).join("\r\n");
  return BOM + head + "\r\n" + body;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime + ";charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCsv(name: string, rows: Record<string, unknown>[], headers?: string[]) {
  downloadFile(`sciorio-${name}-${todayStr()}.csv`, toCsv(rows, headers), "text/csv");
}

// ============ Builders per entità ============

const productName = (products: Product[], id?: string) =>
  products.find((p) => p.id === id)?.name ?? id ?? "";

const clientName = (clients: Client[], id?: string) =>
  clients.find((c) => c.id === id)?.name ?? id ?? "";

const supplierName = (suppliers: Supplier[], id?: string) =>
  suppliers.find((s) => s.id === id)?.name ?? id ?? "";

export function exportClients(clients: Client[]) {
  downloadCsv("clienti", clients.map((c) => ({
    id: c.id, nome: c.name, telefono: c.phone, segmento: c.segment,
    bolli: c.stamps, ultimoOrdine: c.lastOrder ?? "", primoOrdine: c.firstOrder ?? "",
    zona: c.deliveryZone ?? "", fasciaPreferita: c.preferredTimeSlot ?? "",
    tag: c.tags ?? [], note: c.notes ?? "",
  })));
}

export function exportOrders(orders: Order[], clients: Client[], products: Product[]) {
  downloadCsv("ordini", orders.map((o) => ({
    id: o.id, cliente: clientName(clients, o.clientId), etichetta: o.label ?? "",
    dataRitiro: o.pickupDate, stato: o.status, fonte: o.source ?? "",
    totale: o.total.toFixed(2), creato: o.createdAt,
    articoli: o.items.map((i) => `${productName(products, i.productId)} x${i.qty}`).join(" | "),
    note: o.notes ?? "",
  })));
}

export function exportProducts(products: Product[], suppliers: Supplier[]) {
  downloadCsv("prodotti", products.map((p) => ({
    id: p.id, nome: p.name, categoria: p.category, unita: p.unit,
    costo: p.cost ?? "", prezzo: p.price.toFixed(2),
    margine: p.cost != null ? (p.price - p.cost).toFixed(2) : "",
    attivo: p.active ? "si" : "no", disponibile: p.available !== false ? "si" : "no",
    badge: p.badge ?? "", stagionale: p.seasonal ? "si" : "no", magnete: p.magnet ? "si" : "no",
    stock: p.stock ?? "", scortaMin: p.stockMin ?? "",
    fornitore: supplierName(suppliers, p.supplierId), ultimoCarico: p.lastRestock ?? "",
    note: p.notes ?? "",
  })));
}

export function exportDeliveries(deliveries: Delivery[], clients: Client[]) {
  downloadCsv("consegne", deliveries.map((d) => ({
    id: d.id, cliente: clientName(clients, d.clientId), data: d.date, fascia: d.timeSlot,
    indirizzo: d.address, stato: d.status, pagamento: d.payment,
    ordineId: d.orderId ?? "", note: d.notes ?? "", creata: d.createdAt,
  })));
}

export function exportSuppliers(suppliers: Supplier[]) {
  downloadCsv("fornitori", suppliers.map((s) => ({
    id: s.id, nome: s.name, categoria: s.category, contatto: s.contactName ?? "",
    telefono: s.phone ?? "", ultimoOrdine: s.lastOrderDate ?? "",
    nProdotti: (s.productIds ?? []).length, note: s.notes ?? "",
  })));
}

export function exportCashEntries(entries: CashEntry[]) {
  downloadCsv("movimenti-finanziari", entries.map((e) => ({
    id: e.id, data: e.date, tipo: e.type, categoria: e.category,
    importo: e.amount.toFixed(2), metodo: e.method,
    riferimentoTipo: e.refType ?? "", riferimentoId: e.refId ?? "",
    note: e.notes ?? "",
  })));
}

export function exportProductions(prods: Production[], products: Product[]) {
  downloadCsv("produzione", prods.map((p) => ({
    id: p.id, data: p.date, prodotto: productName(products, p.productId),
    qtaPianificata: p.qtyPlanned, qtaEffettiva: p.qtyActual ?? "",
    stato: p.status, ordiniCollegati: (p.orderIds ?? []).length, note: p.notes ?? "",
  })));
}

export function exportStock(products: Product[], suppliers: Supplier[]) {
  const stockProducts = products.filter((p) => p.stock !== undefined || p.stockMin !== undefined);
  downloadCsv("magazzino", stockProducts.map((p) => ({
    id: p.id, nome: p.name, categoria: p.category,
    stock: p.stock ?? 0, scortaMin: p.stockMin ?? 0,
    statoScorta: (p.stock ?? 0) <= 0 ? "esaurito"
                 : (p.stock ?? 0) < (p.stockMin ?? 0) ? "sotto-scorta" : "ok",
    fornitore: supplierName(suppliers, p.supplierId), ultimoCarico: p.lastRestock ?? "",
  })));
}

export function exportPayments(payments: SupplierPayment[], suppliers: Supplier[]) {
  downloadCsv("pagamenti", payments.map((p) => ({
    id: p.id, data: p.date, beneficiario: p.beneficiary, tipo: p.beneficiaryType,
    categoria: p.category, importo: p.amount.toFixed(2), metodo: p.method,
    stato: p.status, scadenza: p.dueDate ?? "", ricorrenza: p.recurrence,
    documento: p.document ?? "", fornitore: supplierName(suppliers, p.supplierId),
    note: p.notes ?? "",
  })));
}

export function exportFreshLogs(logs: FreshLog[], products: Product[]) {
  downloadCsv("freschi-giornaliero", logs.map((l) => ({
    id: l.id, data: l.date, prodotto: productName(products, l.productId),
    inizio: l.qtyStart, vendute: l.qtySold, recuperato: l.qtyRecovered,
    scarto: l.qtyDiscarded, rimasto: l.qtyLeft ?? "", note: l.notes ?? "",
  })));
}

export function exportUnsold(entries: UnsoldEntry[], products: Product[]) {
  downloadCsv("invenduto", entries.map((e) => ({
    id: e.id, data: e.date, prodotto: productName(products, e.productId),
    quantita: e.qty, destinazione: UNSOLD_DESTINATION_LABEL[e.destination],
    valorePerso: (e.valueLost ?? 0).toFixed(2),
    valoreRecuperato: (e.valueRecovered ?? 0).toFixed(2),
    boxTgtg: e.tgtgBoxes ?? "", note: e.notes ?? "",
  })));
}

export function exportSpecialDays(days: SpecialDay[]) {
  downloadCsv("giorni-speciali", days.map((s) => ({
    id: s.id, data: s.date, nome: s.name, impatto: s.impact,
    moltiplicatore: s.multiplier, note: s.notes ?? "",
  })));
}

export function exportGoodsReceipts(receipts: GoodsReceipt[], suppliers: Supplier[], products: Product[]) {
  downloadCsv("entrate-merci", receipts.map((r) => ({
    id: r.id, data: r.date, fornitore: supplierName(suppliers, r.supplierId),
    stato: GOODS_RECEIPT_STATUS_LABEL[r.status],
    articoli: r.items.map((i) => `${productName(products, i.productId)} x${i.qty}`).join(" | "),
    nArticoli: r.items.length,
    totale: calcReceiptTotal(r).toFixed(2),
    corriere: r.carrier ?? "",
    metodoPagamento: r.paymentMethod ?? "",
    nFattura: r.invoiceNumber ?? "",
    dataFattura: r.invoiceDate ?? "",
    nDDT: r.ddtNumber ?? "",
    imponibile: r.taxableAmount?.toFixed(2) ?? "",
    iva: r.vatAmount?.toFixed(2) ?? "",
    totaleDocumento: r.documentTotal?.toFixed(2) ?? "",
    scadenzaPagamento: r.paymentDueDate ?? "",
    statoPagamento: r.paymentStatus ? INVOICE_STATUS_LABEL[r.paymentStatus] : "",
    nAllegati: (r.attachments ?? []).length,
    note: r.notes ?? "",
  })));
}

// ============ JSON BACKUP COMPLETO ============

export interface FullBackup {
  app: "sciorio-hq";
  version: string;
  exportedAt: string;
  data: unknown;
  pin: string | null;
  settings: Record<string, string | null>;
}

const VERSION = "0.4.0";
const STORE_KEY = "sciorio-hq-v4";
const PIN_KEY = "sciorio-hq-pin";
const AUTO_KEY = "sciorio-hq-autobackups";
const AUTO_LAST_KEY = "sciorio-hq-autobackup-last";
const MAX_AUTO = 5;
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildFullBackup(): FullBackup {
  const raw = typeof window !== "undefined" ? localStorage.getItem(STORE_KEY) : null;
  const pin = typeof window !== "undefined" ? localStorage.getItem(PIN_KEY) : null;
  return {
    app: "sciorio-hq",
    version: VERSION,
    exportedAt: new Date().toISOString(),
    data: raw ? JSON.parse(raw) : null,
    pin,
    settings: {},
  };
}

export function downloadFullBackup() {
  const backup = buildFullBackup();
  downloadFile(
    `sciorio-backup-completo-${todayStr()}.json`,
    JSON.stringify(backup, null, 2),
    "application/json",
  );
}

export function validateBackup(text: string): { ok: true; backup: FullBackup } | { ok: false; error: string } {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return { ok: false, error: "File JSON non valido" };
    // Accept either FullBackup or raw store dump
    if (parsed.app === "sciorio-hq" && parsed.data) {
      return { ok: true, backup: parsed as FullBackup };
    }
    if (parsed.products || parsed.clients || parsed.orders) {
      return {
        ok: true,
        backup: {
          app: "sciorio-hq", version: "legacy", exportedAt: new Date().toISOString(),
          data: parsed, pin: null, settings: {},
        },
      };
    }
    return { ok: false, error: "Formato non riconosciuto: manca campo 'data' o entità note" };
  } catch (e) {
    return { ok: false, error: "File corrotto: " + (e as Error).message };
  }
}

export function applyBackup(backup: FullBackup) {
  if (typeof window === "undefined") return;
  if (backup.data) localStorage.setItem(STORE_KEY, JSON.stringify(backup.data));
  if (backup.pin) localStorage.setItem(PIN_KEY, backup.pin);
}

// ============ AUTO BACKUP ============

interface AutoBackupEntry { date: string; size: number; payload: string; }

function readAutoBackups(): AutoBackupEntry[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(AUTO_KEY) ?? "[]"); } catch { return []; }
}

function writeAutoBackups(list: AutoBackupEntry[]) {
  localStorage.setItem(AUTO_KEY, JSON.stringify(list));
}

export function getAutoBackupInfo() {
  const list = readAutoBackups();
  const last = typeof window !== "undefined" ? localStorage.getItem(AUTO_LAST_KEY) : null;
  const totalSize = list.reduce((s, b) => s + b.size, 0);
  return { count: list.length, last, totalKb: +(totalSize / 1024).toFixed(1), list };
}

export function maybeAutoBackup(force = false) {
  if (typeof window === "undefined") return;
  const last = localStorage.getItem(AUTO_LAST_KEY);
  if (!force && last) {
    const elapsed = Date.now() - new Date(last).getTime();
    if (elapsed < ONE_WEEK_MS) return;
  }
  const payload = JSON.stringify(buildFullBackup());
  const entry: AutoBackupEntry = {
    date: new Date().toISOString(), size: new Blob([payload]).size, payload,
  };
  const list = [entry, ...readAutoBackups()].slice(0, MAX_AUTO);
  writeAutoBackups(list);
  localStorage.setItem(AUTO_LAST_KEY, entry.date);
}

export function downloadAutoBackup(date: string) {
  const entry = readAutoBackups().find((b) => b.date === date);
  if (!entry) return;
  downloadFile(`sciorio-autobackup-${date.slice(0, 10)}.json`, entry.payload, "application/json");
}

export function deleteAutoBackup(date: string) {
  writeAutoBackups(readAutoBackups().filter((b) => b.date !== date));
}

// ============ STORAGE STATS ============

export function getStorageStats() {
  if (typeof window === "undefined") return { totalKb: 0, items: [] as { key: string; kb: number }[] };
  const items: { key: string; kb: number }[] = [];
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)!;
    const size = new Blob([localStorage.getItem(k) ?? ""]).size;
    total += size;
    items.push({ key: k, kb: +(size / 1024).toFixed(2) });
  }
  return { totalKb: +(total / 1024).toFixed(1), items: items.sort((a, b) => b.kb - a.kb) };
}

// silence unused param warnings for some types below if tree-shaken
export type _Unused = CasualSale | Bundle | B2BClient;
