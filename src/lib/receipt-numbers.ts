import { useMemo } from "react";
import { useStore } from "@/lib/store";
import type { CasualSale, Order, Delivery } from "@/lib/data";

/** True when an order counts as a battered receipt (ritirato/consegnato). */
export function isOrderBattered(o: Order): boolean {
  return o.status === "ritirato" || o.status === "consegnato";
}

/** True when a delivery counts as a battered receipt (consegnata o pagata). */
export function isDeliveryBattered(d: Delivery): boolean {
  return (
    d.status === "consegnata" ||
    d.payment === "pagato_anticipo" ||
    d.payment === "pagato_consegna"
  );
}

function orderBatteredAt(o: Order): string {
  const tl = o.timeline ?? [];
  // last meaningful completion event, fallback to createdAt
  for (let i = tl.length - 1; i >= 0; i--) {
    const t = tl[i].type;
    if (t === "ritirato" || t === "consegna") return tl[i].date;
  }
  return o.createdAt;
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export interface ReceiptNumberMap {
  /** key = entity id (sale id / order id / delivery id) */
  byId: Record<string, number>;
  /** padded label "Scontrino #001" */
  label: (id: string) => string | null;
}

export function buildReceiptNumberMap(
  casualSales: CasualSale[],
  orders: Order[],
  deliveries: Delivery[],
): ReceiptNumberMap {
  type Ev = { id: string; ts: number; day: string };
  const events: Ev[] = [];

  for (const s of casualSales) {
    events.push({ id: s.id, ts: +new Date(s.date), day: dayKey(s.date) });
  }
  for (const o of orders) {
    if (!isOrderBattered(o)) continue;
    const at = orderBatteredAt(o);
    events.push({ id: o.id, ts: +new Date(at), day: dayKey(at) });
  }
  for (const d of deliveries) {
    if (!isDeliveryBattered(d)) continue;
    // Avoid double-counting: if delivery is tied to an order already battered, skip.
    const tiedOrder = d.orderId ? orders.find((o) => o.id === d.orderId) : undefined;
    if (tiedOrder && isOrderBattered(tiedOrder)) continue;
    events.push({ id: d.id, ts: +new Date(d.createdAt), day: dayKey(d.createdAt) });
  }

  events.sort((a, b) => a.ts - b.ts);

  const counters: Record<string, number> = {};
  const byId: Record<string, number> = {};
  for (const e of events) {
    counters[e.day] = (counters[e.day] ?? 0) + 1;
    byId[e.id] = counters[e.day];
  }

  return {
    byId,
    label: (id: string) => {
      const n = byId[id];
      if (!n) return null;
      return `Scontrino #${String(n).padStart(3, "0")}`;
    },
  };
}

export function useReceiptNumbers(): ReceiptNumberMap {
  const { casualSales, orders, deliveries } = useStore();
  return useMemo(
    () => buildReceiptNumberMap(casualSales, orders, deliveries),
    [casualSales, orders, deliveries],
  );
}

/** Display name for a casual sale: real name, typed name, or "Scontrino #00X". */
export function saleDisplayName(
  sale: { clientId?: string; clientNameInput?: string; id: string },
  clientName: string | undefined,
  receiptLabel: string | null,
): string {
  return clientName ?? sale.clientNameInput ?? receiptLabel ?? "Scontrino";
}