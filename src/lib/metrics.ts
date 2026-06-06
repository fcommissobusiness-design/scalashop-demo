// Metriche derivate. Nessuno stato — sempre calcolato dai dati store.
import type {
  Client, Order, OrderItem, CasualSale, Product, Delivery, Bundle, Segment, LoyaltyEvent,
  Production, CashEntry, SupplierPayment, B2BClient,
  FixedCost, GoodsReceipt, UnsoldEntry, BusinessHours, SpecialDay, ProductCategory,
  OnlineOrder, Shipment,
} from "./data";
import { calcReceiptTotal, calcOnlineOrderCost } from "./data";
import { CRM_DEFAULTS, type CrmSettings } from "./crm-settings";

export const DAY = 86_400_000;
export const now = () => Date.now();

export function clientOrders(orders: Order[], clientId: string) {
  return orders.filter((o) => o.clientId === clientId && o.status === "ritirato");
}
export function clientSales(sales: CasualSale[], clientId: string) {
  return sales.filter((s) => s.clientId === clientId);
}

export function clientLTV(orders: Order[], sales: CasualSale[], clientId: string): number {
  return clientOrders(orders, clientId).reduce((s, o) => s + o.total, 0)
       + clientSales(sales, clientId).reduce((s, x) => s + x.total, 0);
}

export function clientOrderCount(orders: Order[], sales: CasualSale[], clientId: string): number {
  return clientOrders(orders, clientId).length + clientSales(sales, clientId).length;
}

export function clientAvgTicket(orders: Order[], sales: CasualSale[], clientId: string): number {
  const n = clientOrderCount(orders, sales, clientId);
  return n === 0 ? 0 : clientLTV(orders, sales, clientId) / n;
}

export function lastActivityIso(orders: Order[], sales: CasualSale[], client: Client): string | undefined {
  const dates: number[] = [];
  if (client.lastOrder) dates.push(+new Date(client.lastOrder));
  for (const o of clientOrders(orders, client.id)) dates.push(+new Date(o.pickupDate));
  for (const s of clientSales(sales, client.id)) dates.push(+new Date(s.date));
  if (!dates.length) return undefined;
  return new Date(Math.max(...dates)).toISOString();
}

export function daysInactive(orders: Order[], sales: CasualSale[], client: Client): number | null {
  const last = lastActivityIso(orders, sales, client);
  if (!last) return null;
  return Math.floor((now() - +new Date(last)) / DAY);
}

export function clientFrequencyPerMonth(orders: Order[], sales: CasualSale[], client: Client): number {
  const n = clientOrderCount(orders, sales, client.id);
  if (n === 0) return 0;
  const first = client.firstOrder ? +new Date(client.firstOrder) : now() - 30 * DAY;
  const months = Math.max(1, (now() - first) / (30 * DAY));
  return n / months;
}

export type AutoSegment = Segment;
export function suggestSegment(
  orders: Order[], sales: CasualSale[], client: Client, settings: CrmSettings = CRM_DEFAULTS,
): AutoSegment {
  const ltv = clientLTV(orders, sales, client.id);
  const inactive = daysInactive(orders, sales, client) ?? 9999;
  const freq = clientFrequencyPerMonth(orders, sales, client);
  const orderCount = clientOrderCount(orders, sales, client.id);
  const isNew = client.firstOrder
    ? (now() - +new Date(client.firstOrder)) < settings.newDays * DAY
    : true;

  // Inattività progressive (sovrascrivono livello attuale)
  if (inactive > settings.inactiveOccDays) return "inattivi";

  if (isNew && orderCount < 3) return "nuovi";

  // Top
  if ((ltv >= settings.topMinLTV || freq >= settings.topMinFreq) && inactive <= settings.inactiveTopDays)
    return "top";

  // Abituali
  if (freq >= settings.abitualiMinFreq && inactive <= settings.inactiveAbitualiDays)
    return "abituali";

  return "occasionali";
}

export interface SegmentChange {
  clientId: string;
  from: Segment;
  to: Segment;
  event: LoyaltyEvent;
}

/** Compute new segments for non-manual clients; returns the list of changes. */
export function recomputeSegments(
  clients: Client[], orders: Order[], sales: CasualSale[], settings: CrmSettings = CRM_DEFAULTS,
): SegmentChange[] {
  const changes: SegmentChange[] = [];
  for (const c of clients) {
    if (c.segmentManual) continue;
    const next = suggestSegment(orders, sales, c, settings);
    if (next !== c.segment) {
      changes.push({
        clientId: c.id,
        from: c.segment,
        to: next,
        event: {
          date: new Date().toISOString(),
          type: "segment",
          note: `Auto: ${c.segment} → ${next}`,
        },
      });
    }
  }
  return changes;
}

export function recoverableClients(
  orders: Order[], sales: CasualSale[], clients: Client[], settings: CrmSettings = CRM_DEFAULTS,
): Client[] {
  return clients.filter((c) => {
    const d = daysInactive(orders, sales, c);
    if (d === null) return false;
    if (d < settings.recoverableMinDays || d > settings.recoverableMaxDays) return false;
    return clientLTV(orders, sales, c.id) >= settings.recoverableMinLTV;
  });
}

export function topSpenders(
  orders: Order[], sales: CasualSale[], clients: Client[], limit = 5,
): { client: Client; ltv: number }[] {
  return clients
    .map((c) => ({ client: c, ltv: clientLTV(orders, sales, c.id) }))
    .filter((x) => x.ltv > 0)
    .sort((a, b) => b.ltv - a.ltv)
    .slice(0, limit);
}

export function newClientsInPeriod(
  clients: Client[], inPeriod: (iso: string) => boolean,
): Client[] {
  return clients.filter((c) => c.firstOrder && inPeriod(c.firstOrder));
}

export function segmentChangesInPeriod(
  clients: Client[], inPeriod: (iso: string) => boolean,
): { client: Client; event: LoyaltyEvent }[] {
  const out: { client: Client; event: LoyaltyEvent }[] = [];
  for (const c of clients) {
    for (const e of c.loyaltyHistory ?? []) {
      if (e.type === "segment" && inPeriod(e.date)) out.push({ client: c, event: e });
    }
  }
  return out;
}

export function clientTopProducts(orders: Order[], sales: CasualSale[], products: Product[], clientId: string, limit = 5) {
  const map = new Map<string, number>();
  const add = (id: string, q: number) => map.set(id, (map.get(id) ?? 0) + q);
  for (const o of clientOrders(orders, clientId)) for (const i of o.items) add(i.productId, i.qty);
  for (const s of clientSales(sales, clientId)) for (const i of s.items) add(i.productId, i.qty);
  return [...map.entries()]
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id), qty }))
    .filter((x) => x.product)
    .sort((a, b) => b.qty - a.qty).slice(0, limit);
}

export function productMargin(p: Product): { eur: number | null; pct: number | null } {
  if (p.cost == null || p.price === 0) return { eur: null, pct: null };
  const eur = p.price - p.cost;
  return { eur, pct: (eur / p.price) * 100 };
}

export function marginColor(pct: number | null): string {
  if (pct === null) return "text-muted-foreground";
  if (pct < 0) return "text-danger";
  if (pct < 15) return "text-danger";
  if (pct < 30) return "text-warning";
  return "text-success";
}

// ============= Helper riga carrello (Prodotto / Bundle / Riga personalizzata) =============

export function itemKind(i: OrderItem): "product" | "bundle" | "custom" {
  return i.kind ?? "product";
}

export function bundleUnitPrice(b: Bundle): number {
  return b.offerPrice ?? b.fullPrice ?? 0;
}

export function itemUnitPrice(i: OrderItem, products: Product[], bundles: Bundle[]): number {
  if (i.unitPriceOverride != null) return i.unitPriceOverride;
  const k = itemKind(i);
  if (k === "custom") return i.customPrice ?? 0;
  if (k === "bundle") {
    const b = bundles.find((x) => x.id === i.bundleId);
    return b ? bundleUnitPrice(b) : 0;
  }
  const p = products.find((x) => x.id === i.productId);
  return p?.price ?? 0;
}

export function itemUnitCost(i: OrderItem, products: Product[], bundles: Bundle[]): number | null {
  const k = itemKind(i);
  if (k === "custom") {
    if (i.customCost != null) return i.customCost;
    // Se collegata a un prodotto esistente, usa il suo costo
    const p = i.productId ? products.find((x) => x.id === i.productId) : undefined;
    return p?.cost ?? null;
  }
  if (k === "bundle") {
    const b = bundles.find((x) => x.id === i.bundleId);
    return b?.estimatedCost ?? null;
  }
  const p = products.find((x) => x.id === i.productId);
  return p?.cost ?? null;
}

export function itemDisplayName(i: OrderItem, products: Product[], bundles: Bundle[]): string {
  const k = itemKind(i);
  if (k === "custom") return i.customName?.trim() || "Riga personalizzata";
  if (k === "bundle") {
    const b = bundles.find((x) => x.id === i.bundleId);
    return b ? `📦 ${b.name}` : "Bundle";
  }
  const p = products.find((x) => x.id === i.productId);
  return p?.name ?? i.productId;
}

export function itemDisplayUnit(i: OrderItem, products: Product[]): string | undefined {
  const k = itemKind(i);
  if (k !== "product") return undefined;
  const p = products.find((x) => x.id === i.productId);
  return p?.unit;
}

export function itemLineTotal(i: OrderItem, products: Product[], bundles: Bundle[]): number {
  return itemUnitPrice(i, products, bundles) * i.qty;
}

export function cartTotal(items: OrderItem[], products: Product[], bundles: Bundle[]): number {
  return items.reduce((s, i) => s + itemLineTotal(i, products, bundles), 0);
}

// ============= Stats prodotti / bundle =============

export function productSalesStats(orders: Order[], sales: CasualSale[], products: Product[]) {
  const map = new Map<string, { qty: number; revenue: number; profit: number }>();
  const add = (id: string, qty: number) => {
    const p = products.find((x) => x.id === id);
    if (!p) return;
    const cur = map.get(id) ?? { qty: 0, revenue: 0, profit: 0 };
    cur.qty += qty;
    cur.revenue += p.price * qty;
    cur.profit += (p.cost == null ? 0 : (p.price - p.cost) * qty);
    map.set(id, cur);
  };
  const consume = (items: OrderItem[]) => {
    for (const i of items) {
      if (itemKind(i) === "product") add(i.productId, i.qty);
    }
  };
  for (const o of orders) if (o.status === "ritirato") consume(o.items);
  for (const s of sales) consume(s.items);
  return [...map.entries()].map(([id, v]) => ({ product: products.find((p) => p.id === id)!, ...v }))
    .filter((x) => x.product);
}

export function orderMargin(order: Order, products: Product[], bundles: Bundle[] = []): number {
  return order.items.reduce((s, i) => {
    const unitPrice = itemUnitPrice(i, products, bundles);
    const unitCost = itemUnitCost(i, products, bundles);
    if (unitCost == null) return s;
    return s + (unitPrice - unitCost) * i.qty;
  }, 0);
}

export function dailyMargin(orders: Order[], sales: CasualSale[], products: Product[], bundles: Bundle[] = []): number {
  const today = new Date().toDateString();
  const inDay = (iso: string) => new Date(iso).toDateString() === today;
  let m = 0;
  for (const o of orders) if (o.status === "ritirato" && inDay(o.pickupDate)) m += orderMargin(o, products, bundles);
  for (const s of sales) if (inDay(s.date)) m += orderMargin({ items: s.items } as Order, products, bundles);
  return m;
}

export function pendingPickupsToday(orders: Order[]): Order[] {
  const t = new Date().toDateString();
  return orders.filter((o) =>
    (o.status === "in_attesa" || o.status === "pronto") &&
    new Date(o.pickupDate).toDateString() === t,
  );
}

export function lateOrders(orders: Order[]): Order[] {
  const cut = now() - DAY; // più di 24h dopo la data ritiro
  return orders.filter((o) => o.status === "in_attesa" && +new Date(o.pickupDate) < cut);
}

export function inactiveClients(orders: Order[], sales: CasualSale[], clients: Client[], days = 60): Client[] {
  return clients.filter((c) => {
    const d = daysInactive(orders, sales, c);
    return d !== null && d > days;
  });
}

export function loyaltyReadyClients(clients: Client[]): Client[] {
  return clients.filter((c) => (c.stamps ?? 0) >= 5);
}

export function nearLoyaltyClients(clients: Client[]): Client[] {
  return clients.filter((c) => (c.stamps ?? 0) === 4);
}

export function openDeliveries(deliveries: Delivery[]): Delivery[] {
  return deliveries.filter((d) => d.status === "da_preparare" || d.status === "in_consegna");
}

export function clientBadges(orders: Order[], sales: CasualSale[], client: Client): string[] {
  const badges: string[] = [];
  const inactive = daysInactive(orders, sales, client);
  const ltv = clientLTV(orders, sales, client.id);
  if (inactive !== null && inactive <= 7) badges.push("caldo");
  if (inactive !== null && inactive > 60) badges.push("inattivo");
  if (ltv >= 500) badges.push("alto spendente");
  if ((client.stamps ?? 0) === 4) badges.push("vicino premio");
  if ((client.stamps ?? 0) >= 5) badges.push("premio pronto");
  return badges;
}

export function bundleSalesStats(orders: Order[], sales: CasualSale[], bundles: Bundle[]) {
  const map = new Map<string, { qty: number; revenue: number; profit: number }>();
  const add = (id: string, qty: number) => {
    const b = bundles.find((x) => x.id === id);
    if (!b) return;
    const price = bundleUnitPrice(b);
    const cost = b.estimatedCost ?? 0;
    const cur = map.get(id) ?? { qty: 0, revenue: 0, profit: 0 };
    cur.qty += qty;
    cur.revenue += price * qty;
    cur.profit += (price - cost) * qty;
    map.set(id, cur);
  };
  const consume = (items: OrderItem[]) => {
    for (const i of items) {
      if (itemKind(i) === "bundle" && i.bundleId) add(i.bundleId, i.qty);
    }
  };
  for (const o of orders) if (o.status === "ritirato") consume(o.items);
  for (const s of sales) consume(s.items);
  return [...map.entries()].map(([id, v]) => ({ bundle: bundles.find((b) => b.id === id)!, ...v }))
    .filter((x) => x.bundle);
}

export function bundleStatsFromOrders(orders: Order[], bundles: Bundle[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const o of orders) {
    if (o.status !== "ritirato") continue;
    for (const i of o.items) {
      if (itemKind(i) === "bundle" && i.bundleId) {
        m.set(i.bundleId, (m.get(i.bundleId) ?? 0) + i.qty);
      }
    }
  }
  return m;
}

// ============= NUOVE METRICHE v4 =============

const sameDay = (a: Date | string | number, b: Date | string | number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const sameMonth = (a: Date | string | number, b: Date | string | number) => {
  const da = new Date(a), db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth();
};

// Magazzino
export function lowStockProducts(products: Product[]): Product[] {
  return products.filter((p) => p.stock !== undefined && p.stockMin !== undefined && p.stock <= p.stockMin && p.stock > 0);
}
export function outOfStockProducts(products: Product[]): Product[] {
  return products.filter((p) => p.stock !== undefined && p.stock <= 0);
}

// Produzione
export function productionsForDate(productions: Production[], date: Date | string = new Date()): Production[] {
  return productions.filter((p) => sameDay(p.date, date));
}
export function mozzarellaKgForDate(productions: Production[], products: Product[], date: Date | string = new Date()): number {
  return productionsForDate(productions, date).reduce((s, p) => {
    const prod = products.find((x) => x.id === p.productId);
    if (!prod) return s;
    if (!/mozzarella/i.test(prod.name)) return s;
    return s + (p.qtyPlanned ?? 0);
  }, 0);
}

// Cassa
export function cashFlowDay(entries: CashEntry[], date: Date | string = new Date()): { in: number; out: number; balance: number } {
  let inSum = 0, outSum = 0;
  for (const e of entries) {
    if (!sameDay(e.date, date)) continue;
    if (e.type === "entrata") inSum += e.amount; else outSum += e.amount;
  }
  return { in: inSum, out: outSum, balance: inSum - outSum };
}
export function cashFlowMonth(entries: CashEntry[], date: Date | string = new Date()): { in: number; out: number; balance: number } {
  let inSum = 0, outSum = 0;
  for (const e of entries) {
    if (!sameMonth(e.date, date)) continue;
    if (e.type === "entrata") inSum += e.amount; else outSum += e.amount;
  }
  return { in: inSum, out: outSum, balance: inSum - outSum };
}

// Pagamenti fornitori
export function supplierPaymentsDue(payments: SupplierPayment[]): SupplierPayment[] {
  const now = Date.now();
  return payments.filter((p) => p.status === "da_pagare" && (!p.dueDate || +new Date(p.dueDate) >= now - DAY * 2));
}
export function supplierPaymentsOverdue(payments: SupplierPayment[]): SupplierPayment[] {
  const now = Date.now();
  return payments.filter((p) => (p.status === "scaduto") || (p.status === "da_pagare" && p.dueDate && +new Date(p.dueDate) < now));
}
export function recurringMonthlyPayments(payments: SupplierPayment[]): SupplierPayment[] {
  return payments.filter((p) => p.recurrence === "mensile" || p.recurrence === "settimanale");
}
export function paymentsTotalMonth(payments: SupplierPayment[], date: Date | string = new Date()): number {
  return payments.filter((p) => sameMonth(p.date, date) && p.status !== "da_pagare").reduce((s, p) => s + p.amount, 0);
}
export function paymentsByType(payments: SupplierPayment[], date: Date | string = new Date()): Record<string, number> {
  const out: Record<string, number> = { fornitore: 0, consulente: 0, servizio: 0, altro: 0 };
  for (const p of payments) {
    if (!sameMonth(p.date, date)) continue;
    if (p.status === "da_pagare") continue;
    out[p.beneficiaryType] = (out[p.beneficiaryType] ?? 0) + p.amount;
  }
  return out;
}
export function topBeneficiaries(payments: SupplierPayment[], limit = 5): { name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const p of payments) if (p.status !== "da_pagare") map.set(p.beneficiary, (map.get(p.beneficiary) ?? 0) + p.amount);
  return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, limit);
}

// B2B
export function topB2BByRevenue(b2b: B2BClient[], limit = 5): { client: B2BClient; total: number }[] {
  return b2b.map((c) => ({ client: c, total: c.history.reduce((s, h) => s + h.total, 0) }))
    .sort((a, b) => b.total - a.total).slice(0, limit);
}

// Deliveries
export function pendingDeliveryRevenue(deliveries: Delivery[], orders: Order[]): number {
  return deliveries.filter((d) => d.payment === "da_pagare" && d.status !== "annullata")
    .reduce((s, d) => s + (d.orderId ? (orders.find((o) => o.id === d.orderId)?.total ?? 0) : 0), 0);
}

// Average ticket
export function averageReceipt(sales: CasualSale[]): number {
  if (sales.length === 0) return 0;
  return sales.reduce((s, x) => s + x.total, 0) / sales.length;
}

// Margine lordo stimato in periodo (ordini ritirati + scontrini)
export function grossMargin(orders: Order[], sales: CasualSale[], products: Product[], inPeriod: (iso: string) => boolean): number {
  let m = 0;
  const margin = (items: { productId: string; qty: number }[]) =>
    items.reduce((s, i) => {
      const p = products.find((x) => x.id === i.productId);
      if (!p || p.cost == null) return s;
      return s + (p.price - p.cost) * i.qty;
    }, 0);
  for (const o of orders) if (o.status === "ritirato" && inPeriod(o.pickupDate)) m += margin(o.items);
  for (const s of sales) if (inPeriod(s.date)) m += margin(s.items);
  return m;
}

// ============= FINANZA =============

const isOpenDay = (d: Date, hours?: BusinessHours, specials?: SpecialDay[]): boolean => {
  if (!hours) return true;
  const k = d.toISOString().slice(0, 10);
  const sp = specials?.find((s) => s.date.slice(0, 10) === k);
  if (sp && sp.multiplier === 0) return false;
  const KEYS = ["dom","lun","mar","mer","gio","ven","sab"] as const;
  const wk = KEYS[d.getDay()];
  return !hours[wk]?.closed;
};

export function openDaysInMonth(date: Date, hours?: BusinessHours, specials?: SpecialDay[]): number {
  const y = date.getFullYear(), m = date.getMonth();
  const last = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let i = 1; i <= last; i++) if (isOpenDay(new Date(y, m, i), hours, specials)) n++;
  return n;
}

export function openDaysSoFarInMonth(date: Date, hours?: BusinessHours, specials?: SpecialDay[]): number {
  const y = date.getFullYear(), m = date.getMonth();
  let n = 0;
  for (let i = 1; i <= date.getDate(); i++) if (isOpenDay(new Date(y, m, i), hours, specials)) n++;
  return n;
}

/** Costo fisso normalizzato al mese: mensile=amount, annuale=/12, una_tantum=0. Solo attivi. */
export function monthlyFixedCostsTotal(costs: FixedCost[]): number {
  return costs.filter((c) => c.status === "attivo").reduce((s, c) => {
    if (c.frequency === "mensile") return s + c.amount;
    if (c.frequency === "annuale") return s + c.amount / 12;
    return s;
  }, 0);
}

export function fixedCostsByCategory(costs: FixedCost[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of costs) {
    if (c.status !== "attivo") continue;
    const monthly = c.frequency === "mensile" ? c.amount
      : c.frequency === "annuale" ? c.amount / 12 : 0;
    out[c.category] = (out[c.category] ?? 0) + monthly;
  }
  return out;
}

export function topFixedCosts(costs: FixedCost[], limit = 5): FixedCost[] {
  return [...costs.filter((c) => c.status === "attivo")]
    .sort((a, b) => {
      const am = a.frequency === "annuale" ? a.amount / 12 : a.frequency === "mensile" ? a.amount : 0;
      const bm = b.frequency === "annuale" ? b.amount / 12 : b.frequency === "mensile" ? b.amount : 0;
      return bm - am;
    }).slice(0, limit);
}

const inSameMonth = (iso: string, date: Date) => {
  const d = new Date(iso);
  return d.getMonth() === date.getMonth() && d.getFullYear() === date.getFullYear();
};

/** Costi variabili stimati nel mese: COGS (ordini ritirati + scontrini) + valore perso invenduto. */
export function variableCostsMonth(
  orders: Order[], sales: CasualSale[], products: Product[],
  unsold: UnsoldEntry[], date: Date = new Date(),
): { cogs: number; unsoldLoss: number; total: number } {
  const cogs = (items: { productId: string; qty: number }[]) =>
    items.reduce((s, i) => {
      const p = products.find((x) => x.id === i.productId);
      if (!p || p.cost == null) return s;
      return s + p.cost * i.qty;
    }, 0);
  let c = 0;
  for (const o of orders) if (o.status === "ritirato" && inSameMonth(o.pickupDate, date)) c += cogs(o.items);
  for (const s of sales) if (inSameMonth(s.date, date)) c += cogs(s.items);
  let loss = 0;
  for (const u of unsold) if (inSameMonth(u.date, date)) loss += (u.valueLost ?? 0);
  return { cogs: c, unsoldLoss: loss, total: c + loss };
}

/** Totale entrate merci nel mese (alternativa informativa, non sommata a variableCosts per evitare duplicazioni). */
export function goodsReceiptsMonth(receipts: GoodsReceipt[], date: Date = new Date()): number {
  return receipts.filter((r) => inSameMonth(r.date, date))
    .reduce((s, r) => s + calcReceiptTotal(r), 0);
}

/** Pagamenti effettivamente usciti nel mese (solo pagati o scaduti, esclude da_pagare). */
export function paymentsPaidMonth(payments: SupplierPayment[], date: Date = new Date()): number {
  return payments.filter((p) => inSameMonth(p.date, date) && p.status === "pagato")
    .reduce((s, p) => s + p.amount, 0);
}

export function dueSoonPayments(payments: SupplierPayment[], days = 7): SupplierPayment[] {
  const now = Date.now();
  const limit = now + days * DAY;
  return payments.filter((p) => p.status === "da_pagare" && p.dueDate &&
    +new Date(p.dueDate) >= now && +new Date(p.dueDate) <= limit);
}

export interface FinanceForecast {
  monthRevenue: number;
  avgDailyRevenue: number;
  daysOpenSoFar: number;
  daysOpenTotal: number;
  projectedRevenue: number;
  fixedMonth: number;
  variableMonth: number;
  variableProjected: number;
  prudente: number;
  standard: number;
  ottimistico: number;
}

export function forecastMonth(args: {
  orders: Order[]; sales: CasualSale[]; products: Product[]; unsold: UnsoldEntry[];
  fixedCosts: FixedCost[]; hours?: BusinessHours; specials?: SpecialDay[]; date?: Date;
}): FinanceForecast {
  const { orders, sales, products, unsold, fixedCosts, hours, specials } = args;
  const date = args.date ?? new Date();
  const revOrders = orders.filter((o) => o.status === "ritirato" && inSameMonth(o.pickupDate, date))
    .reduce((s, o) => s + o.total, 0);
  const revSales = sales.filter((s) => inSameMonth(s.date, date)).reduce((s, x) => s + x.total, 0);
  const monthRevenue = revOrders + revSales;

  const daysOpenTotal = openDaysInMonth(date, hours, specials);
  const daysOpenSoFar = Math.max(1, openDaysSoFarInMonth(date, hours, specials));
  const avgDailyRevenue = monthRevenue / daysOpenSoFar;
  const projectedRevenue = avgDailyRevenue * daysOpenTotal;

  const fixedMonth = monthlyFixedCostsTotal(fixedCosts);
  const variable = variableCostsMonth(orders, sales, products, unsold, date);
  const variableProjected = (variable.total / daysOpenSoFar) * daysOpenTotal;

  const standard = projectedRevenue - fixedMonth - variableProjected;
  const prudente = projectedRevenue * 0.85 - fixedMonth - variableProjected * 1.10;
  const ottimistico = projectedRevenue * 1.10 - fixedMonth - variableProjected * 0.95;

  return {
    monthRevenue, avgDailyRevenue, daysOpenSoFar, daysOpenTotal,
    projectedRevenue, fixedMonth,
    variableMonth: variable.total, variableProjected,
    prudente, standard, ottimistico,
  };
}

/** Margine per categoria di prodotto sul mese. */
export function marginByCategoryMonth(
  orders: Order[], sales: CasualSale[], products: Product[], date: Date = new Date(),
): { category: ProductCategory; revenue: number; cogs: number; margin: number }[] {
  const map = new Map<ProductCategory, { revenue: number; cogs: number }>();
  const add = (items: { productId: string; qty: number }[]) => {
    for (const it of items) {
      const p = products.find((x) => x.id === it.productId);
      if (!p) continue;
      const cur = map.get(p.category) ?? { revenue: 0, cogs: 0 };
      cur.revenue += p.price * it.qty;
      cur.cogs += (p.cost ?? 0) * it.qty;
      map.set(p.category, cur);
    }
  };
  for (const o of orders) if (o.status === "ritirato" && inSameMonth(o.pickupDate, date)) add(o.items);
  for (const s of sales) if (inSameMonth(s.date, date)) add(s.items);
  return [...map.entries()].map(([category, v]) => ({ category, revenue: v.revenue, cogs: v.cogs, margin: v.revenue - v.cogs }))
    .sort((a, b) => b.margin - a.margin);
}

export function topSuppliersByCost(payments: SupplierPayment[], limit = 5): { name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const p of payments) {
    if (p.status === "da_pagare") continue;
    if (p.beneficiaryType !== "fornitore") continue;
    map.set(p.beneficiary, (map.get(p.beneficiary) ?? 0) + p.amount);
  }
  return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, limit);
}

export function topConsultantsByCost(payments: SupplierPayment[], limit = 5): { name: string; total: number }[] {
  const map = new Map<string, number>();
  for (const p of payments) {
    if (p.status === "da_pagare") continue;
    if (p.beneficiaryType !== "consulente" && p.beneficiaryType !== "servizio") continue;
    map.set(p.beneficiary, (map.get(p.beneficiary) ?? 0) + p.amount);
  }
  return [...map.entries()].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, limit);
}

// ============= E-COMMERCE =============


const monthFn = (date: Date) => (iso: string) => inSameMonth(iso, date);

export function ecomOrdersInMonth(orders: OnlineOrder[], date: Date = new Date()): OnlineOrder[] {
  const f = monthFn(date);
  return orders.filter((o) => f(o.date));
}

/** Fatturato online del mese: solo ordini pagati (non rimborsati) e non annullati. */
export function ecomRevenueMonth(orders: OnlineOrder[], date: Date = new Date()): number {
  return ecomOrdersInMonth(orders, date)
    .filter((o) => o.paymentStatus === "pagato" && o.status !== "annullato")
    .reduce((s, o) => s + o.total, 0);
}

export function ecomMarginMonth(orders: OnlineOrder[], products: Product[], date: Date = new Date()): number {
  return ecomOrdersInMonth(orders, date)
    .filter((o) => o.paymentStatus === "pagato" && o.status !== "annullato")
    .reduce((s, o) => s + (o.total - calcOnlineOrderCost(o, products) - (o.shippingCost ?? 0)), 0);
}

export function ecomShippingCostMonth(orders: OnlineOrder[], date: Date = new Date()): number {
  return ecomOrdersInMonth(orders, date)
    .filter((o) => o.status !== "annullato")
    .reduce((s, o) => s + (o.shippingCost ?? 0), 0);
}

export function ecomCogsMonth(orders: OnlineOrder[], products: Product[], date: Date = new Date()): number {
  return ecomOrdersInMonth(orders, date)
    .filter((o) => o.status !== "annullato")
    .reduce((s, o) => s + calcOnlineOrderCost(o, products), 0);
}

export function shipmentsByStatus(shipments: Shipment[]): Record<Shipment["status"], number> {
  const out: Record<Shipment["status"], number> = {
    da_preparare: 0, affidata: 0, in_transito: 0, consegnata: 0, problema: 0,
  };
  for (const s of shipments) out[s.status]++;
  return out;
}

export function avgShippingCost(orders: OnlineOrder[]): number {
  const withCost = orders.filter((o) => typeof o.shippingCost === "number" && o.shippingCost! > 0);
  if (withCost.length === 0) return 0;
  return withCost.reduce((s, o) => s + (o.shippingCost ?? 0), 0) / withCost.length;
}

export function ecomByPlatform(orders: OnlineOrder[], products: Product[], date?: Date):
  { platform: OnlineOrder["platform"]; orders: number; revenue: number; margin: number }[] {
  const list = date ? ecomOrdersInMonth(orders, date) : orders;
  const map = new Map<OnlineOrder["platform"], { orders: number; revenue: number; margin: number }>();
  for (const o of list) {
    if (o.status === "annullato") continue;
    const cur = map.get(o.platform) ?? { orders: 0, revenue: 0, margin: 0 };
    cur.orders++;
    if (o.paymentStatus === "pagato") {
      cur.revenue += o.total;
      cur.margin += o.total - calcOnlineOrderCost(o, products) - (o.shippingCost ?? 0);
    }
    map.set(o.platform, cur);
  }
  return [...map.entries()].map(([platform, v]) => ({ platform, ...v })).sort((a, b) => b.revenue - a.revenue);
}

export function topOnlineProducts(orders: OnlineOrder[], products: Product[], limit = 5):
  { product: Product; qty: number; revenue: number }[] {
  const map = new Map<string, { qty: number; revenue: number }>();
  for (const o of orders) {
    if (o.status === "annullato") continue;
    for (const it of o.items) {
      if (!it.productId) continue;
      const cur = map.get(it.productId) ?? { qty: 0, revenue: 0 };
      cur.qty += it.qty;
      cur.revenue += (it.unitPrice ?? 0) * it.qty;
      map.set(it.productId, cur);
    }
  }
  return [...map.entries()]
    .map(([id, v]) => ({ product: products.find((p) => p.id === id)!, ...v }))
    .filter((x) => x.product)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, limit);
}

export function problematicOnlineOrders(orders: OnlineOrder[], shipments: Shipment[]): OnlineOrder[] {
  const problemIds = new Set(shipments.filter((s) => s.status === "problema").map((s) => s.orderId));
  return orders.filter((o) =>
    o.status === "annullato" ||
    o.paymentStatus === "rimborsato" ||
    problemIds.has(o.id)
  );
}

/** Calcola la fascia oraria preferita del cliente in base agli orari di ritiro/scontrino. */
export function clientPreferredTimeSlotAuto(orders: Order[], sales: CasualSale[], clientId: string): string | null {
  const buckets: Record<string, { label: string; count: number }> = {
    morning_early: { label: "Mattina presto (07–10)", count: 0 },
    morning_late:  { label: "Mattina tarda (10–13)", count: 0 },
    afternoon:     { label: "Pomeriggio (13–17)", count: 0 },
    evening:       { label: "Sera (17–20)", count: 0 },
  };
  const add = (iso: string) => {
    const h = new Date(iso).getHours();
    if (h >= 7 && h < 10) buckets.morning_early.count++;
    else if (h >= 10 && h < 13) buckets.morning_late.count++;
    else if (h >= 13 && h < 17) buckets.afternoon.count++;
    else if (h >= 17 && h < 20) buckets.evening.count++;
  };
  for (const o of clientOrders(orders, clientId)) add(o.pickupDate);
  for (const s of clientSales(sales, clientId)) add(s.date);
  const best = Object.values(buckets).sort((a, b) => b.count - a.count)[0];
  return best && best.count > 0 ? best.label : null;
}

