import { useEffect, useState } from "react";
import {
  SEED_PRODUCTS, SEED_CLIENTS, SEED_ORDERS, SEED_BUNDLES, SEED_CASUAL_SALES, SEED_DELIVERIES,
  SEED_PRODUCTIONS, SEED_SUPPLIERS, SEED_CASH_ENTRIES, SEED_B2B_CLIENTS, SEED_SUPPLIER_PAYMENTS,
  SEED_FRESH_LOGS, SEED_UNSOLD_ENTRIES, SEED_SPECIAL_DAYS, DEFAULT_BUSINESS_HOURS,
  SEED_GOODS_RECEIPTS, SEED_FIXED_COSTS, SEED_ONLINE_ORDERS, SEED_SHIPMENTS,
  SEED_LOTS, SEED_HACCP_READINGS, SEED_CLEANING_TASKS, SEED_TRASH,
  generateLotCode,
  type Product, type Client, type Order, type Bundle, type CasualSale, type Delivery, type DeliveryMode,
  type OrderEvent, type LoyaltyEvent,
  type Production, type Supplier, type CashEntry, type B2BClient, type SupplierPayment,
  type FreshLog, type UnsoldEntry, type SpecialDay, type BusinessHours,
  type GoodsReceipt, type FixedCost, type OnlineOrder, type Shipment,
  type Lot, type HaccpReading, type CleaningTask,
  type TrashEntry, type TrashKind,
} from "./data";
import { CLIENT_IMPORT_V7, applyClientImportV7 } from "./client-import";

const KEY = "sciorio-hq-v4";
const LEGACY_V3 = "sciorio-hq-v3";
const LEGACY_KEY = "sciorio-hq-v2";
const PIN_KEY = "sciorio-hq-auth";
const PIN_VALUE_KEY = "sciorio-hq-pin";
const DEFAULT_PIN = "0000";

interface Store {
  products: Product[];
  clients: Client[];
  orders: Order[];
  bundles: Bundle[];
  casualSales: CasualSale[];
  deliveries: Delivery[];
  productions: Production[];
  suppliers: Supplier[];
  cashEntries: CashEntry[];
  b2bClients: B2BClient[];
  supplierPayments: SupplierPayment[];
  freshLogs: FreshLog[];
  unsoldEntries: UnsoldEntry[];
  specialDays: SpecialDay[];
  businessHours: BusinessHours;
  goodsReceipts: GoodsReceipt[];
  fixedCosts: FixedCost[];
  onlineOrders: OnlineOrder[];
  shipments: Shipment[];
  lots: Lot[];
  haccpReadings: HaccpReading[];
  cleaningTasks: CleaningTask[];
  trash: TrashEntry[];
}

const SEED: Store = {
  products: SEED_PRODUCTS,
  clients: SEED_CLIENTS,
  orders: SEED_ORDERS,
  bundles: SEED_BUNDLES,
  casualSales: SEED_CASUAL_SALES,
  deliveries: SEED_DELIVERIES,
  productions: SEED_PRODUCTIONS,
  suppliers: SEED_SUPPLIERS,
  cashEntries: SEED_CASH_ENTRIES,
  b2bClients: SEED_B2B_CLIENTS,
  supplierPayments: SEED_SUPPLIER_PAYMENTS,
  freshLogs: SEED_FRESH_LOGS,
  unsoldEntries: SEED_UNSOLD_ENTRIES,
  specialDays: SEED_SPECIAL_DAYS,
  businessHours: DEFAULT_BUSINESS_HOURS,
  goodsReceipts: SEED_GOODS_RECEIPTS,
  fixedCosts: SEED_FIXED_COSTS,
  onlineOrders: SEED_ONLINE_ORDERS,
  shipments: SEED_SHIPMENTS,
  lots: SEED_LOTS,
  haccpReadings: SEED_HACCP_READINGS,
  cleaningTasks: SEED_CLEANING_TASKS,
  trash: SEED_TRASH,
};

function migrate(parsed: any): Store {
  // One-time refresh of clients list (real customers list) — drop legacy demo clients.
  const clientsSeedV2 = parsed.__clientsSeedV2 === true;
  const clientsSource = parsed.clients ?? SEED.clients;
  // One-time wipe of demo orders/sales/deliveries so LTV/scontrino medio partono da zero.
  const cleanV3 = parsed.__cleanSeedV3 === true;
  // Catalogo Maggio 2026: forza il re-seed di prodotti e bundle col listino aggiornato.
  const catalogV4 = parsed.__catalogV4 === true;
  // Pulizia dati demo residui (statistiche, costi, pagamenti fittizi).
  const demoCleanV5 = parsed.__demoCleanV5 === true;
  // V6: wipe definitivo di costi fissi demo, pagamenti e cash demo (gestionale "pulito").
  const demoCleanV6 = parsed.__demoCleanV6 === true;
  // V7: import lista clienti ufficiale (segmento + telefoni) — applicato una sola volta.
  const importedClientCount = Array.isArray(parsed.clients) ? parsed.clients.length : 0;
  const clientsImportV7 = parsed.__clientsImportV7 === true && importedClientCount >= CLIENT_IMPORT_V7.length;
  const productsSource = catalogV4 ? (parsed.products ?? SEED.products) : SEED.products;
  const bundlesSource = catalogV4 ? (parsed.bundles ?? SEED.bundles) : SEED.bundles;
  const keep = <T,>(field: T[] | undefined, seed: T[]): T[] =>
    demoCleanV5 ? (field ?? seed) : (field ?? []);
  // V6: forza azzeramento (una sola volta) di liste transazionali che potrebbero contenere demo.
  const wipeOnce = <T,>(field: T[] | undefined): T[] =>
    demoCleanV6 ? (field ?? []) : [];
  const out: Store = {
    products: productsSource.map((p: Product) => ({
      available: true, seasonal: false, magnet: false, ...p,
    })),
    clients: clientsSource.map((c: Client) => ({
      ...c,
      loyaltyHistory: c.loyaltyHistory ?? [],
      tags: c.tags ?? [],
      preferredProducts: c.preferredProducts ?? [],
    })),
    orders: cleanV3 ? (parsed.orders ?? []) : [],
    bundles: bundlesSource,
    casualSales: cleanV3 ? (parsed.casualSales ?? []) : [],
    deliveries: cleanV3 ? (parsed.deliveries ?? []) : [],
    productions: keep(parsed.productions, SEED.productions),
    suppliers: parsed.suppliers ?? SEED.suppliers,
    cashEntries: wipeOnce(parsed.cashEntries),
    b2bClients: keep(parsed.b2bClients, SEED.b2bClients),
    supplierPayments: wipeOnce(parsed.supplierPayments),
    freshLogs: keep(parsed.freshLogs, []),
    unsoldEntries: keep(parsed.unsoldEntries, []),
    specialDays: keep(parsed.specialDays, SEED.specialDays),
    businessHours: parsed.businessHours ?? SEED.businessHours,
    goodsReceipts: keep(parsed.goodsReceipts, SEED.goodsReceipts),
    fixedCosts: wipeOnce(parsed.fixedCosts),
    onlineOrders: keep(parsed.onlineOrders, SEED.onlineOrders),
    shipments: keep(parsed.shipments, SEED.shipments),
    lots: keep(parsed.lots, SEED.lots),
    haccpReadings: keep(parsed.haccpReadings, SEED.haccpReadings),
    cleaningTasks: keep(parsed.cleaningTasks, SEED.cleaningTasks),
    trash: parsed.trash ?? [],
  };
  // V7: applica una sola volta l'import della lista clienti ufficiale.
  if (!clientsImportV7) {
    out.clients = applyClientImportV7(out.clients);
  }
  (out as any).__clientsSeedV2 = true;
  (out as any).__cleanSeedV3 = true;
  (out as any).__catalogV4 = true;
  (out as any).__demoCleanV5 = true;
  (out as any).__demoCleanV6 = true;
  (out as any).__clientsImportV7 = true;
  return out;
}


function load(): Store {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate(JSON.parse(raw));
    const v3 = localStorage.getItem(LEGACY_V3);
    if (v3) {
      const m = migrate(JSON.parse(v3));
      localStorage.setItem(KEY, JSON.stringify(m));
      return m;
    }
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const m = migrate(JSON.parse(legacy));
      localStorage.setItem(KEY, JSON.stringify(m));
      return m;
    }
  } catch {}
  // Prima installazione: applica anche qui l'import lista clienti V7.
  const fresh: Store = { ...SEED, clients: applyClientImportV7(SEED.clients) };
  (fresh as any).__clientsImportV7 = true;
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

const listeners = new Set<() => void>();
let cache: Store | null = null;

function getStore(): Store {
  if (!cache) cache = load();
  return cache;
}

let _isApplyingRemote = false;

function setStore(next: Store) {
  cache = next;
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(next));
  listeners.forEach((l) => l());
}

// Cloud sync helpers (used by useCloudSync)
export function getStoreSnapshot(): Store { return getStore(); }
export function subscribeStore(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
export function applyRemoteStore(next: Store) {
  _isApplyingRemote = true;
  try { setStore(migrate(next)); } finally { _isApplyingRemote = false; }
}
export function isApplyingRemote(): boolean { return _isApplyingRemote; }
export function resetStoreToSeed() { setStore(SEED); }

const uid = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const nowIso = () => new Date().toISOString();

let crmAutoRan = false;
let clientsImportAutoRan = false;

function resolveOrderClient<T extends { clientId: string; clientNameInput?: string; delivery?: DeliveryMode; address?: string }>(state: Store, input: T): { input: T; clients: Client[] } {
  const typedName = (input.clientNameInput ?? "").trim();
  const byId = input.clientId ? state.clients.find((c) => c.id === input.clientId) : undefined;
  if (byId) {
    return { input: { ...input, clientNameInput: typedName || byId.name } as T, clients: state.clients };
  }
  if (!typedName) return { input, clients: state.clients };
  const exact = state.clients.find((c) => c.name.trim().toLowerCase() === typedName.toLowerCase());
  if (exact) {
    return { input: { ...input, clientId: exact.id, clientNameInput: typedName } as T, clients: state.clients };
  }
  const address = input.delivery === "domicilio" ? input.address?.trim() : undefined;
  const client: Client = {
    id: uid("c_"),
    name: typedName,
    phone: "",
    segment: "nuovi",
    stamps: 0,
    loyaltyHistory: [],
    deliveryZone: address || undefined,
    addresses: address ? [address] : undefined,
  };
  return {
    input: { ...input, clientId: client.id, clientNameInput: typedName } as T,
    clients: [client, ...state.clients],
  };
}

function applyOrderRitirato(store: Store, order: Order): Store {
  // aggiorna stamps cliente, lastOrder, loyaltyHistory
  const clients = store.clients.map((c) => {
    if (c.id !== order.clientId) return c;
    const newStamps = Math.min(5, (c.stamps ?? 0) + 1);
    const hist: LoyaltyEvent[] = [...(c.loyaltyHistory ?? []), {
      date: nowIso(), type: "stamp", delta: 1, note: `Ordine ${order.id}`,
    }];
    return {
      ...c,
      stamps: newStamps,
      lastOrder: order.pickupDate,
      loyaltyHistory: hist,
    };
  });
  return { ...store, clients };
}

function applyReceiptStock(store: Store, rec: GoodsReceipt, sign: 1 | -1): Store {
  const deltaBy = new Map<string, number>();
  for (const it of rec.items) {
    deltaBy.set(it.productId, (deltaBy.get(it.productId) ?? 0) + sign * it.qty);
  }
  return {
    ...store,
    products: store.products.map((p) => {
      const d = deltaBy.get(p.id);
      if (!d) return p;
      const cur = p.stock ?? 0;
      const nextStock = Math.max(0, +(cur + d).toFixed(3));
      return {
        ...p,
        stock: nextStock,
        supplierId: sign > 0 ? rec.supplierId : p.supplierId,
        lastRestock: sign > 0 ? rec.date : p.lastRestock,
      };
    }),
  };
}

// Crea/aggiorna Lot per ogni riga della ricevuta.
// Regole: stesso prodotto + stesso lotCode → somma; lotCode diverso o assente → riga separata.
// Scadenza = data ricevuta + shelfLifeDays prodotto, fallback 72h.
function applyReceiptLots(store: Store, rec: GoodsReceipt): Store {
  let lots = [...store.lots];
  const created: Lot[] = [];
  for (const it of rec.items) {
    const p = store.products.find(x => x.id === it.productId);
    const baseDate = new Date(rec.date);
    const expiry = new Date(baseDate);
    if (p?.shelfLifeDays && p.shelfLifeDays > 0) {
      expiry.setDate(expiry.getDate() + p.shelfLifeDays);
    } else {
      expiry.setHours(expiry.getHours() + 72);
    }
    const code = (it.lotCode && it.lotCode.trim())
      ? it.lotCode.trim()
      : generateLotCode(rec.date, [...lots, ...created]);
    // Cerca lotto esistente con stesso productId+code (merge)
    const existingIdx = lots.findIndex(l => l.productId === it.productId && l.code === code);
    if (existingIdx >= 0) {
      const ex = lots[existingIdx];
      lots[existingIdx] = {
        ...ex,
        qtyInitial: +(ex.qtyInitial + it.qty).toFixed(3),
        qtyRemaining: +(ex.qtyRemaining + it.qty).toFixed(3),
      };
    } else {
      created.push({
        id: uid("lt_"), code, productId: it.productId,
        productionDate: rec.date, expiryDate: expiry.toISOString(),
        qtyInitial: it.qty, qtyRemaining: it.qty,
        supplierId: rec.supplierId, receiptId: rec.id,
        notes: it.notes, createdAt: nowIso(),
      });
    }
  }
  return { ...store, lots: [...created, ...lots] };
}

// Rimuove i lotti collegati a una ricevuta (es. annullamento/cancellazione)
function removeReceiptLots(store: Store, receiptId: string): Store {
  return { ...store, lots: store.lots.filter(l => l.receiptId !== receiptId) };
}

function applyOnlineOrderStock(store: Store, o: OnlineOrder, sign: 1 | -1): Store {
  const deltaBy = new Map<string, number>();
  for (const it of o.items) {
    if (!it.productId) continue;
    deltaBy.set(it.productId, (deltaBy.get(it.productId) ?? 0) + sign * it.qty);
  }
  if (deltaBy.size === 0) return store;
  return {
    ...store,
    products: store.products.map((p) => {
      const d = deltaBy.get(p.id);
      if (!d || p.stock === undefined) return p;
      return { ...p, stock: Math.max(0, +(p.stock + d).toFixed(3)) };
    }),
  };
}

function pushTrash(store: Store, kind: TrashKind, refId: string, label: string, data: unknown): Store {
  const entry: TrashEntry = {
    id: uid("tr_"), kind, refId, label, deletedAt: nowIso(), data,
  };
  return { ...store, trash: [entry, ...(store.trash ?? [])] };
}

export function useStore() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((t) => t + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  // Auto import clienti ufficiali: corregge anche stati cloud vecchi già salvati con soli 84 clienti.
  useEffect(() => {
    if (clientsImportAutoRan) return;
    clientsImportAutoRan = true;
    const cur = getStore() as Store & { __clientsImportV7?: boolean };
    if (cur.__clientsImportV7 !== true || (cur.clients?.length ?? 0) < CLIENT_IMPORT_V7.length) {
      setStore(migrate(cur));
    }
  }, []);
  // Auto CRM (segmentazione automatica) — gira una volta per sessione, dopo il caricamento.
  useEffect(() => {
    if (crmAutoRan) return;
    crmAutoRan = true;
    // Lazy import per evitare cicli
    Promise.resolve().then(async () => {
      const { recomputeSegments } = await import("./metrics");
      const { loadCrmSettings } = await import("./crm-settings");
      const cur = getStore();
      const changes = recomputeSegments(cur.clients, cur.orders, cur.casualSales, loadCrmSettings());
      if (changes.length === 0) return;
      const byId = new Map(changes.map((c) => [c.clientId, c] as const));
      setStore({
        ...cur,
        clients: cur.clients.map((c) => {
          const ch = byId.get(c.id);
          if (!ch) return c;
          return {
            ...c,
            segment: ch.to,
            loyaltyHistory: [...(c.loyaltyHistory ?? []), ch.event],
          };
        }),
      });
    });
  }, []);
  // FIX CRITICO multi-mutazione: `store` è un Proxy live sulla cache.
  // Senza Proxy, due mutazioni nello stesso ciclo render (es. addClient + addOrder)
  // catturavano lo stesso snapshot e la seconda sovrascriveva la prima,
  // facendo perdere il cliente appena creato.
  const store = new Proxy({} as Store, {
    get(_t, prop) { return (getStore() as any)[prop]; },
    has(_t, prop) { return prop in getStore(); },
    ownKeys() { return Reflect.ownKeys(getStore()); },
    getOwnPropertyDescriptor(_t, prop) {
      const desc = Object.getOwnPropertyDescriptor(getStore(), prop);
      if (!desc) return undefined;
      return { ...desc, configurable: true };
    },
  });
  return {
    ...store,

    // PRODUCTS
    addProduct: (p: Omit<Product, "id">) => {
      const id = uid("p_");
      const created: Product = { ...p, id };
      setStore({ ...store, products: [created, ...store.products] });
      return created;
    },

    updateProduct: (id: string, patch: Partial<Product>) => {
      setStore({
        ...store,
        products: store.products.map((p) => {
          if (p.id !== id) return p;
          // priceHistory automatico
          let history = p.priceHistory ?? [];
          if ((patch.price !== undefined && patch.price !== p.price) ||
              (patch.cost !== undefined && patch.cost !== p.cost)) {
            history = [...history, { date: nowIso(), cost: p.cost, price: p.price }];
          }
          return { ...p, ...patch, priceHistory: history };
        }),
      });
    },
    deleteProduct: (id: string) =>
      setStore({ ...store, products: store.products.filter((p) => p.id !== id) }),

    // ORDERS
    addOrder: (o: Omit<Order, "id" | "createdAt">) => {
      const resolved = resolveOrderClient(getStore(), o);
      o = resolved.input;
      const orderId = uid("o_");
      let deliveryId: string | undefined = o.deliveryId;
      let nextDeliveries = store.deliveries;
      // Sync: ordine con consegna a domicilio → crea anche Delivery
      if (o.delivery === "domicilio" && !deliveryId) {
        deliveryId = uid("d_");
        const client = store.clients.find(c => c.id === o.clientId);
        const del: Delivery = {
          id: deliveryId, clientId: o.clientId,
          address: o.address || client?.deliveryZone || "",
          date: o.pickupDate,
          timeSlot: "—",
          status: o.status === "consegnato" ? "consegnata"
                : o.status === "annullato" ? "annullata"
                : o.status === "da_consegnare" ? "in_consegna"
                : "da_preparare",
          payment: o.payment ?? "da_pagare",
          orderId, notes: o.notes,
          createdAt: nowIso(),
        };
        nextDeliveries = [del, ...store.deliveries];
      }
      const order: Order = {
        ...o, id: orderId, createdAt: nowIso(), deliveryId,
        timeline: [{ date: nowIso(), type: "creato" }],
        source: o.source ?? "negozio",
      };
      let next: Store = { ...store, clients: resolved.clients, orders: [order, ...store.orders], deliveries: nextDeliveries };
      if (order.status === "ritirato") next = applyOrderRitirato(next, order);
      setStore(next);
      return order;
    },
    updateOrder: (id: string, patch: Partial<Order>) => {
      const prev = store.orders.find((o) => o.id === id);
      if (!prev) return;
      const willBecomeRitirato = patch.status === "ritirato" && prev.status !== "ritirato";
      const tl = [...(prev.timeline ?? [])];
      if (patch.status && patch.status !== prev.status) {
        tl.push({ date: nowIso(), type: patch.status as OrderEvent["type"] });
      } else {
        tl.push({ date: nowIso(), type: "modificato" });
      }
      const merged: Order = { ...prev, ...patch, timeline: tl };
      let nextDeliveries = store.deliveries;
      // Sync verso Delivery collegata
      if (merged.deliveryId) {
        nextDeliveries = nextDeliveries.map(d => {
          if (d.id !== merged.deliveryId) return d;
          const dPatch: Partial<Delivery> = {};
          if (patch.status) {
            dPatch.status = merged.status === "consegnato" ? "consegnata"
              : merged.status === "annullato" ? "annullata"
              : merged.status === "da_consegnare" ? "in_consegna"
              : "da_preparare";
          }
          if (patch.address !== undefined) dPatch.address = merged.address || d.address;
          if (patch.payment !== undefined && merged.payment) dPatch.payment = merged.payment;
          if (patch.pickupDate) dPatch.date = merged.pickupDate;
          if (patch.notes !== undefined) dPatch.notes = merged.notes;
          return { ...d, ...dPatch };
        });
      }
      let next: Store = { ...store, orders: store.orders.map((o) => o.id === id ? merged : o), deliveries: nextDeliveries };
      if (willBecomeRitirato) next = applyOrderRitirato(next, merged);
      setStore(next);
    },
    duplicateOrder: (id: string) => {
      const o = store.orders.find((x) => x.id === id);
      if (!o) return null;
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0);
      const dup: Order = {
        ...o, id: uid("o_"), createdAt: nowIso(),
        pickupDate: d.toISOString(), status: "in_attesa",
        deliveryId: undefined,
        timeline: [{ date: nowIso(), type: "creato", note: `Duplicato da ${o.id}` }],
      };
      setStore({ ...store, orders: [dup, ...store.orders] });
      return dup;
    },
    deleteOrder: (id: string) => {
      const o = store.orders.find(x => x.id === id);
      if (!o) return;
      const client = store.clients.find(c => c.id === o.clientId);
      const label = `Ordine ${client?.name ?? o.clientId} · ${new Date(o.pickupDate).toLocaleDateString("it-IT")}`;
      const del = o.deliveryId ? store.deliveries.find(d => d.id === o.deliveryId) : undefined;
      const nextDeliveries = del ? store.deliveries.filter(d => d.id !== del.id) : store.deliveries;
      let next: Store = { ...store, orders: store.orders.filter((x) => x.id !== id), deliveries: nextDeliveries };
      next = pushTrash(next, "order", o.id, label, { order: o, delivery: del });
      setStore(next);
    },


    // BUNDLES
    addBundle: (b: Omit<Bundle, "id">) => {
      setStore({ ...store, bundles: [{ ...b, id: uid("b_") }, ...store.bundles] });
    },
    updateBundle: (id: string, patch: Partial<Bundle>) =>
      setStore({ ...store, bundles: store.bundles.map((b) => b.id === id ? { ...b, ...patch } : b) }),
    deleteBundle: (id: string) => {
      const b = store.bundles.find(x => x.id === id);
      if (!b) return;
      let next: Store = { ...store, bundles: store.bundles.filter((x) => x.id !== id) };
      next = pushTrash(next, "bundle", b.id, `Bundle ${b.name}`, b);
      setStore(next);
    },

    // CLIENTS
    addClient: (c: Omit<Client, "id">) => {
      const client: Client = { ...c, id: uid("c_"), loyaltyHistory: [] };
      setStore({ ...store, clients: [client, ...store.clients] });
      return client;
    },
    updateClient: (id: string, patch: Partial<Client>) =>
      setStore({ ...store, clients: store.clients.map((c) => c.id === id ? { ...c, ...patch } : c) }),
    deleteClient: (id: string) =>
      setStore({ ...store, clients: store.clients.filter((c) => c.id !== id) }),

    // LOYALTY
    addLoyaltyEvent: (clientId: string, ev: Omit<LoyaltyEvent, "date"> & { date?: string }) => {
      setStore({
        ...store,
        clients: store.clients.map((c) => {
          if (c.id !== clientId) return c;
          const event: LoyaltyEvent = { date: ev.date ?? nowIso(), type: ev.type, delta: ev.delta, note: ev.note };
          let stamps = c.stamps ?? 0;
          if (ev.type === "stamp") stamps = Math.min(5, stamps + (ev.delta ?? 1));
          if (ev.type === "reset") stamps = 0;
          if (ev.type === "reward") stamps = 0;
          if (ev.type === "manual" && typeof ev.delta === "number") stamps = Math.max(0, Math.min(5, stamps + ev.delta));
          return { ...c, stamps, loyaltyHistory: [...(c.loyaltyHistory ?? []), event] };
        }),
      });
    },
    setLoyaltyStamps: (clientId: string, value: number) => {
      setStore({
        ...store,
        clients: store.clients.map((c) => c.id === clientId
          ? { ...c, stamps: Math.max(0, Math.min(5, value)),
              loyaltyHistory: [...(c.loyaltyHistory ?? []), { date: nowIso(), type: "manual" as const, note: `Impostato a ${value}` }] }
          : c),
      });
    },

    // CASUAL SALES
    addCasualSale: (s: Omit<CasualSale, "id">) => {
      const sale: CasualSale = { ...s, id: uid("s_") };
      setStore({ ...store, casualSales: [sale, ...store.casualSales] });
      return sale;
    },
    updateCasualSale: (id: string, patch: Partial<CasualSale>) =>
      setStore({ ...store, casualSales: store.casualSales.map((s) => s.id === id ? { ...s, ...patch } : s) }),
    deleteCasualSale: (id: string) => {
      const s = store.casualSales.find(x => x.id === id);
      if (!s) return;
      const label = `Scontrino · ${new Date(s.date).toLocaleDateString("it-IT")} · €${s.total.toFixed(2)}`;
      let next: Store = { ...store, casualSales: store.casualSales.filter((x) => x.id !== id) };
      next = pushTrash(next, "casualSale", s.id, label, s);
      setStore(next);
    },

    // DELIVERIES
    addDelivery: (d: Omit<Delivery, "id" | "createdAt">) => {
      const delId = uid("d_");
      let orderId = d.orderId;
      let nextOrders = store.orders;
      // Sync: nuova consegna senza ordine → crea Ordine "da_consegnare"
      if (!orderId) {
        orderId = uid("o_");
        const order: Order = {
          id: orderId, clientId: d.clientId, items: [],
          pickupDate: d.date,
          status: d.status === "consegnata" ? "consegnato"
                : d.status === "annullata" ? "annullato"
                : "da_consegnare",
          total: 0, createdAt: nowIso(),
          source: "negozio", delivery: "domicilio",
          address: d.address, payment: d.payment,
          deliveryId: delId,
          timeline: [{ date: nowIso(), type: "creato", note: "Da consegna" }],
        };
        nextOrders = [order, ...store.orders];
      } else {
        // collega l'ordine esistente
        nextOrders = store.orders.map(o => o.id === orderId ? { ...o, deliveryId: delId } : o);
      }
      const del: Delivery = { ...d, id: delId, orderId, createdAt: nowIso() };
      setStore({ ...store, deliveries: [del, ...store.deliveries], orders: nextOrders });
      return del;
    },
    updateDelivery: (id: string, patch: Partial<Delivery>) => {
      const prev = store.deliveries.find(d => d.id === id);
      if (!prev) return;
      const merged: Delivery = { ...prev, ...patch };
      let nextOrders = store.orders;
      if (merged.orderId) {
        nextOrders = nextOrders.map(o => {
          if (o.id !== merged.orderId) return o;
          const oPatch: Partial<Order> = {};
          if (patch.status) {
            oPatch.status = merged.status === "consegnata" ? "consegnato"
              : merged.status === "annullata" ? "annullato"
              : "da_consegnare";
          }
          if (patch.address !== undefined) oPatch.address = merged.address;
          if (patch.payment !== undefined) oPatch.payment = merged.payment;
          if (patch.date) oPatch.pickupDate = merged.date;
          return { ...o, ...oPatch };
        });
      }
      setStore({ ...store, deliveries: store.deliveries.map(d => d.id === id ? merged : d), orders: nextOrders });
    },
    deleteDelivery: (id: string) => {
      const d = store.deliveries.find(x => x.id === id);
      if (!d) return;
      const client = store.clients.find(c => c.id === d.clientId);
      const label = `Consegna ${client?.name ?? ""} · ${new Date(d.date).toLocaleDateString("it-IT")}`;
      const nextOrders = d.orderId
        ? store.orders.map(o => o.id === d.orderId ? { ...o, deliveryId: undefined } : o)
        : store.orders;
      let next: Store = { ...store, deliveries: store.deliveries.filter(x => x.id !== id), orders: nextOrders };
      next = pushTrash(next, "delivery", d.id, label, d);
      setStore(next);
    },


    // PRODUCTIONS
    addProduction: (p: Omit<Production, "id">) => {
      const prod: Production = { ...p, id: uid("pr_") };
      setStore({ ...store, productions: [prod, ...store.productions] });
      return prod;
    },
    updateProduction: (id: string, patch: Partial<Production>) =>
      setStore({ ...store, productions: store.productions.map((p) => p.id === id ? { ...p, ...patch } : p) }),
    deleteProduction: (id: string) =>
      setStore({ ...store, productions: store.productions.filter((p) => p.id !== id) }),

    // SUPPLIERS
    addSupplier: (s: Omit<Supplier, "id">) => {
      const sup: Supplier = { ...s, id: uid("sup_") };
      setStore({ ...store, suppliers: [sup, ...store.suppliers] });
      return sup;
    },
    updateSupplier: (id: string, patch: Partial<Supplier>) =>
      setStore({ ...store, suppliers: store.suppliers.map((s) => s.id === id ? { ...s, ...patch } : s) }),
    deleteSupplier: (id: string) => {
      const s = store.suppliers.find(x => x.id === id);
      if (!s) return;
      let next: Store = { ...store, suppliers: store.suppliers.filter((x) => x.id !== id) };
      next = pushTrash(next, "supplier", s.id, `Fornitore ${s.name}`, s);
      setStore(next);
    },

    // CASH ENTRIES
    addCashEntry: (e: Omit<CashEntry, "id">) => {
      const entry: CashEntry = { ...e, id: uid("ce_") };
      setStore({ ...store, cashEntries: [entry, ...store.cashEntries] });
      return entry;
    },
    updateCashEntry: (id: string, patch: Partial<CashEntry>) =>
      setStore({ ...store, cashEntries: store.cashEntries.map((e) => e.id === id ? { ...e, ...patch } : e) }),
    deleteCashEntry: (id: string) =>
      setStore({ ...store, cashEntries: store.cashEntries.filter((e) => e.id !== id) }),

    // B2B
    addB2BClient: (c: Omit<B2BClient, "id">) => {
      const cli: B2BClient = { ...c, id: uid("b2b_") };
      setStore({ ...store, b2bClients: [cli, ...store.b2bClients] });
      return cli;
    },
    updateB2BClient: (id: string, patch: Partial<B2BClient>) =>
      setStore({ ...store, b2bClients: store.b2bClients.map((c) => c.id === id ? { ...c, ...patch } : c) }),
    deleteB2BClient: (id: string) =>
      setStore({ ...store, b2bClients: store.b2bClients.filter((c) => c.id !== id) }),

    // SUPPLIER PAYMENTS
    addSupplierPayment: (p: Omit<SupplierPayment, "id">) => {
      const pay: SupplierPayment = { ...p, id: uid("sp_") };
      setStore({ ...store, supplierPayments: [pay, ...store.supplierPayments] });
      return pay;
    },
    updateSupplierPayment: (id: string, patch: Partial<SupplierPayment>) =>
      setStore({ ...store, supplierPayments: store.supplierPayments.map((p) => p.id === id ? { ...p, ...patch } : p) }),
    deleteSupplierPayment: (id: string) => {
      const p = store.supplierPayments.find(x => x.id === id);
      if (!p) return;
      const label = `Pagamento ${p.beneficiary} · €${p.amount.toFixed(2)}`;
      let next: Store = { ...store, supplierPayments: store.supplierPayments.filter((x) => x.id !== id) };
      next = pushTrash(next, "supplierPayment", p.id, label, p);
      setStore(next);
    },

    // FRESH LOGS
    addFreshLog: (l: Omit<FreshLog, "id">) => {
      const log: FreshLog = { ...l, id: uid("fl_") };
      setStore({ ...store, freshLogs: [log, ...store.freshLogs] });
      return log;
    },
    updateFreshLog: (id: string, patch: Partial<FreshLog>) =>
      setStore({ ...store, freshLogs: store.freshLogs.map((l) => l.id === id ? { ...l, ...patch } : l) }),
    deleteFreshLog: (id: string) =>
      setStore({ ...store, freshLogs: store.freshLogs.filter((l) => l.id !== id) }),

    // UNSOLD ENTRIES
    addUnsoldEntry: (u: Omit<UnsoldEntry, "id">) => {
      const e: UnsoldEntry = { ...u, id: uid("un_") };
      setStore({ ...store, unsoldEntries: [e, ...store.unsoldEntries] });
      return e;
    },
    updateUnsoldEntry: (id: string, patch: Partial<UnsoldEntry>) =>
      setStore({ ...store, unsoldEntries: store.unsoldEntries.map((e) => e.id === id ? { ...e, ...patch } : e) }),
    deleteUnsoldEntry: (id: string) =>
      setStore({ ...store, unsoldEntries: store.unsoldEntries.filter((e) => e.id !== id) }),

    // SPECIAL DAYS
    addSpecialDay: (s: Omit<SpecialDay, "id">) => {
      const d: SpecialDay = { ...s, id: uid("sd_") };
      setStore({ ...store, specialDays: [d, ...store.specialDays] });
      return d;
    },
    updateSpecialDay: (id: string, patch: Partial<SpecialDay>) =>
      setStore({ ...store, specialDays: store.specialDays.map((s) => s.id === id ? { ...s, ...patch } : s) }),
    deleteSpecialDay: (id: string) =>
      setStore({ ...store, specialDays: store.specialDays.filter((s) => s.id !== id) }),

    // BUSINESS HOURS
    setBusinessHours: (h: BusinessHours) => setStore({ ...store, businessHours: h }),

    // GOODS RECEIPTS
    addGoodsReceipt: (r: Omit<GoodsReceipt, "id" | "createdAt">) => {
      const rec: GoodsReceipt = { ...r, id: uid("gr_"), createdAt: nowIso() };
      let next: Store = { ...store, goodsReceipts: [rec, ...store.goodsReceipts] };
      // Aggiorna stock prodotti se ricevuta/verificata/archiviata
      if (rec.status !== "attesa") {
        next = applyReceiptStock(next, rec, +1);
        next = applyReceiptLots(next, rec);
      }
      // Aggiorna lastOrderDate fornitore
      next = {
        ...next,
        suppliers: next.suppliers.map((s) =>
          s.id === rec.supplierId ? { ...s, lastOrderDate: rec.date } : s),
      };
      setStore(next);
      return rec;
    },
    updateGoodsReceipt: (id: string, patch: Partial<GoodsReceipt>) => {
      const prev = store.goodsReceipts.find((g) => g.id === id);
      if (!prev) return;
      const merged: GoodsReceipt = { ...prev, ...patch };
      let next: Store = { ...store, goodsReceipts: store.goodsReceipts.map((g) => g.id === id ? merged : g) };
      const wasReceived = prev.status !== "attesa";
      const isReceived = merged.status !== "attesa";
      if (!wasReceived && isReceived) {
        next = applyReceiptStock(next, merged, +1);
        next = applyReceiptLots(next, merged);
      } else if (wasReceived && !isReceived) {
        next = applyReceiptStock(next, prev, -1);
        next = removeReceiptLots(next, prev.id);
      }
      setStore(next);
    },
    deleteGoodsReceipt: (id: string) => {
      const prev = store.goodsReceipts.find((g) => g.id === id);
      if (!prev) return;
      let next: Store = { ...store, goodsReceipts: store.goodsReceipts.filter((g) => g.id !== id) };
      if (prev.status !== "attesa") {
        next = applyReceiptStock(next, prev, -1);
        next = removeReceiptLots(next, prev.id);
      }
      setStore(next);
    },

    // FIXED COSTS
    addFixedCost: (f: Omit<FixedCost, "id">) => {
      const fc: FixedCost = { ...f, id: uid("fc_") };
      setStore({ ...store, fixedCosts: [fc, ...store.fixedCosts] });
      return fc;
    },
    updateFixedCost: (id: string, patch: Partial<FixedCost>) =>
      setStore({ ...store, fixedCosts: store.fixedCosts.map((f) => f.id === id ? { ...f, ...patch } : f) }),
    deleteFixedCost: (id: string) => {
      const f = store.fixedCosts.find(x => x.id === id);
      if (!f) return;
      let next: Store = { ...store, fixedCosts: store.fixedCosts.filter((x) => x.id !== id) };
      next = pushTrash(next, "fixedCost", f.id, `Costo fisso ${f.name}`, f);
      setStore(next);
    },

    // TRASH (Cestino)
    restoreTrash: (trashId: string) => {
      const e = (store.trash ?? []).find(x => x.id === trashId);
      if (!e) return;
      let next: Store = { ...store, trash: store.trash.filter(x => x.id !== trashId) };
      const data = e.data as any;
      switch (e.kind) {
        case "order": {
          const o = data?.order as Order | undefined;
          if (!o) break;
          next = { ...next, orders: [o, ...next.orders.filter(x => x.id !== o.id)] };
          const d = data?.delivery as Delivery | undefined;
          if (d) next = { ...next, deliveries: [d, ...next.deliveries.filter(x => x.id !== d.id)] };
          break;
        }
        case "casualSale":
          next = { ...next, casualSales: [data as CasualSale, ...next.casualSales.filter(x => x.id !== e.refId)] }; break;
        case "delivery":
          next = { ...next, deliveries: [data as Delivery, ...next.deliveries.filter(x => x.id !== e.refId)] }; break;
        case "bundle":
          next = { ...next, bundles: [data as Bundle, ...next.bundles.filter(x => x.id !== e.refId)] }; break;
        case "supplier":
          next = { ...next, suppliers: [data as Supplier, ...next.suppliers.filter(x => x.id !== e.refId)] }; break;
        case "supplierPayment":
          next = { ...next, supplierPayments: [data as SupplierPayment, ...next.supplierPayments.filter(x => x.id !== e.refId)] }; break;
        case "fixedCost":
          next = { ...next, fixedCosts: [data as FixedCost, ...next.fixedCosts.filter(x => x.id !== e.refId)] }; break;
        case "client":
          next = { ...next, clients: [data as Client, ...next.clients.filter(x => x.id !== e.refId)] }; break;
        case "b2bClient":
          next = { ...next, b2bClients: [data as B2BClient, ...next.b2bClients.filter(x => x.id !== e.refId)] }; break;
        case "product":
          next = { ...next, products: [data as Product, ...next.products.filter(x => x.id !== e.refId)] }; break;
      }
      setStore(next);
    },
    purgeTrash: (trashId: string) =>
      setStore({ ...store, trash: store.trash.filter(x => x.id !== trashId) }),
    emptyTrash: () => setStore({ ...store, trash: [] }),

    // ONLINE ORDERS
    addOnlineOrder: (o: Omit<OnlineOrder, "id" | "createdAt">) => {
      const order: OnlineOrder = { ...o, id: uid("eo_"), createdAt: nowIso() };
      let next: Store = { ...store, onlineOrders: [order, ...store.onlineOrders] };
      if (order.status === "spedito" || order.status === "consegnato") {
        next = applyOnlineOrderStock(next, order, -1);
      }
      setStore(next);
      return order;
    },
    addOnlineOrders: (orders: Omit<OnlineOrder, "id" | "createdAt">[]) => {
      const made: OnlineOrder[] = orders.map((o) => ({ ...o, id: uid("eo_"), createdAt: nowIso() }));
      let next: Store = { ...store, onlineOrders: [...made, ...store.onlineOrders] };
      for (const o of made) {
        if (o.status === "spedito" || o.status === "consegnato") next = applyOnlineOrderStock(next, o, -1);
      }
      setStore(next);
      return made;
    },
    updateOnlineOrder: (id: string, patch: Partial<OnlineOrder>) => {
      const prev = store.onlineOrders.find((o) => o.id === id);
      if (!prev) return;
      const merged: OnlineOrder = { ...prev, ...patch };
      let next: Store = { ...store, onlineOrders: store.onlineOrders.map((o) => o.id === id ? merged : o) };
      const wasOut = prev.status === "spedito" || prev.status === "consegnato";
      const isOut = merged.status === "spedito" || merged.status === "consegnato";
      if (!wasOut && isOut) next = applyOnlineOrderStock(next, merged, -1);
      else if (wasOut && !isOut) next = applyOnlineOrderStock(next, prev, +1);
      setStore(next);
    },
    deleteOnlineOrder: (id: string) => {
      const prev = store.onlineOrders.find((o) => o.id === id);
      if (!prev) return;
      let next: Store = {
        ...store,
        onlineOrders: store.onlineOrders.filter((o) => o.id !== id),
        shipments: store.shipments.filter((sh) => sh.orderId !== id),
      };
      if (prev.status === "spedito" || prev.status === "consegnato") {
        next = applyOnlineOrderStock(next, prev, +1);
      }
      setStore(next);
    },

    // SHIPMENTS
    addShipment: (sh: Omit<Shipment, "id" | "createdAt">) => {
      const s: Shipment = { ...sh, id: uid("sh_"), createdAt: nowIso() };
      setStore({ ...store, shipments: [s, ...store.shipments] });
      return s;
    },
    updateShipment: (id: string, patch: Partial<Shipment>) =>
      setStore({ ...store, shipments: store.shipments.map((s) => s.id === id ? { ...s, ...patch } : s) }),
    deleteShipment: (id: string) =>
      setStore({ ...store, shipments: store.shipments.filter((s) => s.id !== id) }),

    // LOTS
    addLot: (l: Omit<Lot, "id" | "createdAt">) => {
      const lot: Lot = { ...l, id: uid("lt_"), createdAt: nowIso() };
      setStore({ ...store, lots: [lot, ...store.lots] });
      return lot;
    },
    updateLot: (id: string, patch: Partial<Lot>) =>
      setStore({ ...store, lots: store.lots.map((l) => l.id === id ? { ...l, ...patch } : l) }),
    deleteLot: (id: string) =>
      setStore({ ...store, lots: store.lots.filter((l) => l.id !== id) }),
    consumeLot: (id: string, qty: number) =>
      setStore({ ...store, lots: store.lots.map((l) =>
        l.id === id ? { ...l, qtyRemaining: Math.max(0, +(l.qtyRemaining - qty).toFixed(3)) } : l) }),

    // HACCP READINGS
    addHaccpReading: (r: Omit<HaccpReading, "id">) => {
      const reading: HaccpReading = { ...r, id: uid("hr_") };
      setStore({ ...store, haccpReadings: [reading, ...store.haccpReadings] });
      return reading;
    },
    updateHaccpReading: (id: string, patch: Partial<HaccpReading>) =>
      setStore({ ...store, haccpReadings: store.haccpReadings.map((r) => r.id === id ? { ...r, ...patch } : r) }),
    deleteHaccpReading: (id: string) =>
      setStore({ ...store, haccpReadings: store.haccpReadings.filter((r) => r.id !== id) }),

    // CLEANING TASKS
    addCleaningTask: (t: Omit<CleaningTask, "id">) => {
      const task: CleaningTask = { ...t, id: uid("cl_") };
      setStore({ ...store, cleaningTasks: [task, ...store.cleaningTasks] });
      return task;
    },
    updateCleaningTask: (id: string, patch: Partial<CleaningTask>) =>
      setStore({ ...store, cleaningTasks: store.cleaningTasks.map((t) => t.id === id ? { ...t, ...patch } : t) }),
    deleteCleaningTask: (id: string) =>
      setStore({ ...store, cleaningTasks: store.cleaningTasks.filter((t) => t.id !== id) }),

    importJson: (text: string) => {
      const parsed = JSON.parse(text);
      const next = migrate(parsed);
      setStore(next);
    },
    storageInfo: () => {
      let bytes = 0;
      if (typeof window !== "undefined") {
        bytes = new Blob([localStorage.getItem(KEY) ?? ""]).size;
      }
      return {
        bytes,
        kb: +(bytes / 1024).toFixed(1),
        counts: {
          products: store.products.length,
          clients: store.clients.length,
          orders: store.orders.length,
          bundles: store.bundles.length,
          casualSales: store.casualSales.length,
          deliveries: store.deliveries.length,
          productions: store.productions.length,
          suppliers: store.suppliers.length,
          cashEntries: store.cashEntries.length,
          b2bClients: store.b2bClients.length,
          supplierPayments: store.supplierPayments.length,
          goodsReceipts: store.goodsReceipts.length,
        },
      };
    },

    reset: () => {
      if (typeof window !== "undefined") {
        localStorage.removeItem(KEY);
        localStorage.removeItem(LEGACY_V3);
        localStorage.removeItem(LEGACY_KEY);
      }
      cache = null;
      setStore(load());
    },

    // CRM
    runCrmAuto: async () => {
      const { recomputeSegments } = await import("./metrics");
      const { loadCrmSettings } = await import("./crm-settings");
      const cur = getStore();
      const changes = recomputeSegments(cur.clients, cur.orders, cur.casualSales, loadCrmSettings());
      if (changes.length === 0) return 0;
      const byId = new Map(changes.map((c) => [c.clientId, c] as const));
      setStore({
        ...cur,
        clients: cur.clients.map((c) => {
          const ch = byId.get(c.id);
          if (!ch) return c;
          return { ...c, segment: ch.to, loyaltyHistory: [...(c.loyaltyHistory ?? []), ch.event] };
        }),
      });
      return changes.length;
    },
    logClientEvent: (clientId: string, type: LoyaltyEvent["type"], note?: string) => {
      setStore({
        ...store,
        clients: store.clients.map((c) => c.id === clientId
          ? { ...c, loyaltyHistory: [...(c.loyaltyHistory ?? []), { date: nowIso(), type, note }] }
          : c),
      });
    },
  };
}

export function getPin(): string {
  if (typeof window === "undefined") return DEFAULT_PIN;
  return localStorage.getItem(PIN_VALUE_KEY) ?? DEFAULT_PIN;
}

export function setPin(newPin: string) {
  if (typeof window === "undefined") return;
  if (!/^\d{4}$/.test(newPin)) throw new Error("Il PIN deve essere di 4 cifre");
  localStorage.setItem(PIN_VALUE_KEY, newPin);
}

export function useAuth() {
  const [authed, setAuthed] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);
  useEffect(() => {
    setAuthed(localStorage.getItem(PIN_KEY) === "1");
    setReady(true);
  }, []);
  return {
    authed,
    ready,
    login: (pin: string) => {
      if (pin === getPin()) {
        localStorage.setItem(PIN_KEY, "1");
        setAuthed(true);
        return true;
      }
      return false;
    },
    logout: () => { localStorage.removeItem(PIN_KEY); setAuthed(false); },
  };
}
