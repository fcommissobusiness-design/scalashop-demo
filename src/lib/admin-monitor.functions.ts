import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ADMIN_EMAIL = "rossetonigianni@gmail.com";
const ADMIN_USER_ID = "e7a93a94-878e-45de-97eb-5bae42052044";

export function isAdminDemoAccount(userId?: string | null): boolean {
  return !!userId && userId === ADMIN_USER_ID;
}

export type DemoUserRow = {
  userId: string;
  email: string | null;
  businessName: string | null;
  phone: string | null;
  createdAt: string | null;
  firstSeen: number | null;
  lastSeen: number | null;
  loginCount: number;
  totalMs: number;
  trialStart: number | null;
  counts: {
    clients: number;
    products: number;
    orders: number;
    deliveries: number;
    receipts: number;
  };
  onboarding: Record<string, any> | null;
};

export const getDemoUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    if (!isAdminDemoAccount(context.userId)) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1) Tutti gli utenti auth (pagina per pagina, demo piccola).
    type AuthUser = {
      id: string; email?: string | null; created_at?: string | null;
      user_metadata?: Record<string, any> | null;
    };
    const users: AuthUser[] = [];
    let page = 1;
    while (true) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const u of data.users) users.push(u as AuthUser);
      if (!data.users || data.users.length < 200) break;
      page++;
      if (page > 25) break; // safety
    }

    // 2) Stati cloud (snapshot per utente).
    const { data: states, error: stErr } = await supabaseAdmin
      .from("user_state")
      .select("user_id, data, updated_at");
    if (stErr) throw stErr;
    const stateByUser = new Map<string, { data: any; updated_at: string }>();
    for (const r of (states ?? []) as any[]) {
      stateByUser.set(r.user_id, { data: r.data ?? {}, updated_at: r.updated_at });
    }

    const rows: DemoUserRow[] = [];
    for (const u of users) {
      const email = (u.email ?? "").toLowerCase();
      if (!email || isAdminDemoAccount(u.id)) continue; // escludi admin
      const st = stateByUser.get(u.id);
      const data = st?.data ?? {};
      const meta = (data.__demoMeta ?? {}) as Record<string, any>;
      const len = (k: string) => Array.isArray(data?.[k]) ? data[k].length : 0;
      rows.push({
        userId: u.id,
        email: u.email ?? null,
        businessName:
          meta?.onboarding?.businessName ??
          u.user_metadata?.business_name ?? null,
        phone:
          meta?.onboarding?.phone ??
          u.user_metadata?.phone ?? null,
        createdAt: u.created_at ?? null,
        firstSeen: typeof meta.firstSeen === "number" ? meta.firstSeen : null,
        lastSeen: typeof meta.lastSeen === "number" ? meta.lastSeen : null,
        loginCount: Number(meta.loginCount ?? 0),
        totalMs: Number(meta.totalMs ?? 0),
        trialStart: typeof meta.trialStart === "number" ? meta.trialStart : null,
        counts: {
          clients: len("clients"),
          products: len("products"),
          orders: len("orders"),
          deliveries: len("deliveries"),
          receipts: len("casualSales"),
        },
        onboarding: (meta.onboarding ?? null) as any,
      });
    }
    return { users: rows };
  });