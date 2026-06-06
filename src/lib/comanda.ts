// Genera una comanda compatta (formato 80mm/post-it) in una nuova finestra
// e avvia il dialogo di stampa del browser, che permette anche il salvataggio in PDF.

import type { Order, OrderItem, CasualSale, Delivery, Client, Product, Bundle } from "./data";
import { itemDisplayName, itemKind, itemDisplayUnit } from "./metrics";

export type ComandaKind = "order" | "sale" | "delivery";

interface ComandaLine {
  name: string;
  qty: number;
  unit?: string;
}

export interface ComandaData {
  kind: ComandaKind;
  title: string;
  ref?: string; // ID / progressivo breve
  dateLabel?: string;
  client?: { name?: string; phone?: string; address?: string };
  meta?: Array<{ label: string; value: string }>;
  items: ComandaLine[];
  notes?: string;
  total?: number;
}

function fmtEuro(n: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}
function fmtQty(qty: number, unit?: string) {
  const isInt = Number.isInteger(qty) || (unit !== "kg" && unit !== "g");
  const v = isInt ? Math.round(qty).toString() : qty.toFixed(2).replace(",", ",");
  return unit ? `${v} ${unit}` : v;
}

function toComandaLines(items: OrderItem[], products: Product[], bundles: Bundle[]): ComandaLine[] {
  return items.map((i) => ({
    name: itemDisplayName(i, products, bundles),
    qty: i.qty,
    unit: itemDisplayUnit(i, products),
  }));
}

export function buildOrderComanda(o: Order, c: Client | undefined, products: Product[], bundles: Bundle[] = []): ComandaData {
  const items = toComandaLines(o.items, products, bundles);
  const d = new Date(o.pickupDate);
  return {
    kind: "order",
    title: "COMANDA · ORDINE",
    ref: o.id.slice(-5).toUpperCase(),
    dateLabel: d.toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    client: c ? { name: c.name, phone: c.phone, address: o.delivery === "domicilio" ? o.address : undefined } : undefined,
    meta: [
      { label: "Modalità", value: o.delivery === "domicilio" ? "Consegna" : "Ritiro" },
      { label: "Stato", value: o.status.replace(/_/g, " ") },
    ],
    items,
    notes: o.notes,
    total: o.total,
  };
}

export function buildSaleComanda(s: CasualSale, c: Client | undefined, products: Product[], bundles: Bundle[] = []): ComandaData {
  const items = toComandaLines(s.items, products, bundles);
  return {
    kind: "sale",
    title: "COMANDA · SCONTRINO",
    ref: s.id.slice(-5).toUpperCase(),
    dateLabel: new Date(s.date).toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    client: c ? { name: c.name, phone: c.phone } : s.clientNameInput ? { name: s.clientNameInput } : undefined,
    items,
    notes: s.notes,
    total: s.total,
  };
}

export function buildDeliveryComanda(d: Delivery, c: Client | undefined, linkedOrder: Order | null, products: Product[], bundles: Bundle[] = []): ComandaData {
  const items: ComandaLine[] = linkedOrder ? toComandaLines(linkedOrder.items, products, bundles) : [];
  return {
    kind: "delivery",
    title: "COMANDA · CONSEGNA",
    ref: d.id.slice(-5).toUpperCase(),
    dateLabel: new Date(d.date).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }),
    client: c ? { name: c.name, phone: c.phone, address: d.address } : { address: d.address },
    meta: [
      { label: "Fascia", value: d.timeSlot },
      { label: "Pagamento", value: d.payment.replace(/_/g, " ") },
    ],
    items,
    notes: d.notes,
    total: linkedOrder?.total,
  };
}
// (void) suppress unused
void itemKind;

export function printComanda(data: ComandaData) {
  const html = renderHtml(data);
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) {
    alert("Abilita i popup per stampare la comanda.");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Attendere il render, poi stampare
  setTimeout(() => {
    try { w.focus(); w.print(); } catch { /* ignore */ }
  }, 250);
}

function renderHtml(d: ComandaData): string {
  const itemsRows = d.items.map((i) =>
    `<tr><td class="qty">${fmtQty(i.qty, i.unit)}</td><td class="nm">${escapeHtml(i.name)}</td></tr>`
  ).join("");
  const metaRows = (d.meta ?? []).map((m) =>
    `<div class="row"><span class="lbl">${escapeHtml(m.label)}</span><span class="val">${escapeHtml(m.value)}</span></div>`
  ).join("");
  return `<!doctype html>
<html lang="it"><head><meta charset="utf-8"><title>${escapeHtml(d.title)} ${d.ref ?? ""}</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  html, body { margin: 0; padding: 0; font-family: 'Courier New', ui-monospace, monospace; color: #000; background: #fff; }
  body { width: 72mm; padding: 4mm 0; font-size: 12px; line-height: 1.35; }
  h1 { font-size: 13px; margin: 0 0 4px; text-align: center; letter-spacing: 1px; }
  .sub { text-align: center; font-size: 11px; margin-bottom: 6px; }
  .sep { border-top: 1px dashed #000; margin: 6px 0; }
  .row { display: flex; justify-content: space-between; gap: 6px; font-size: 11px; }
  .lbl { color: #555; }
  .val { font-weight: bold; text-align: right; }
  table { width: 100%; border-collapse: collapse; margin-top: 2px; }
  td { vertical-align: top; padding: 2px 0; font-size: 12px; }
  td.qty { width: 26mm; font-weight: bold; white-space: nowrap; }
  td.nm  { padding-left: 4px; }
  .notes { font-style: italic; font-size: 11px; padding: 4px 0; }
  .total { font-size: 14px; font-weight: bold; text-align: right; padding-top: 4px; }
  .footer { text-align: center; font-size: 10px; color: #555; margin-top: 6px; }
  @media print { .noprint { display: none; } }
  .noprint { text-align: center; padding: 8px 0; }
  .noprint button { font-size: 12px; padding: 4px 12px; cursor: pointer; }
</style></head>
<body>
  <h1>${escapeHtml(d.title)}</h1>
  <div class="sub">${d.ref ? `#${escapeHtml(d.ref)} · ` : ""}${escapeHtml(d.dateLabel ?? "")}</div>
  ${d.client ? `<div class="sep"></div>
    ${d.client.name ? `<div class="row"><span class="lbl">Cliente</span><span class="val">${escapeHtml(d.client.name)}</span></div>` : ""}
    ${d.client.phone ? `<div class="row"><span class="lbl">Tel</span><span class="val">${escapeHtml(d.client.phone)}</span></div>` : ""}
    ${d.client.address ? `<div class="row"><span class="lbl">Indirizzo</span><span class="val">${escapeHtml(d.client.address)}</span></div>` : ""}` : ""}
  ${metaRows ? `<div class="sep"></div>${metaRows}` : ""}
  <div class="sep"></div>
  ${itemsRows ? `<table>${itemsRows}</table>` : `<div class="notes">Nessun prodotto.</div>`}
  <div class="sep"></div><div class="notes">Note: ${d.notes ? escapeHtml(d.notes) : "—"}</div>
  ${typeof d.total === "number" ? `<div class="sep"></div><div class="total">TOTALE ${fmtEuro(d.total)}</div>` : ""}
  <div class="footer">Sciorio Gastronomia</div>
  <div class="noprint"><button onclick="window.print()">Stampa / Salva PDF</button> <button onclick="window.close()">Chiudi</button></div>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
