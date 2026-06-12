import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type RoleRow = { user_id: string; role: "admin" | "user" };

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
  deleted?: boolean;
  deletedAt?: string | null;
};

export const getAdminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (error) throw error;
    return { isAdmin: data?.role === "admin" };
  });

export const getDemoUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: myRole, error: roleErr } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin");
    if (roleErr) throw roleErr;
    if (!((myRole ?? []) as Pick<RoleRow, "role">[]).some((r) => r.role === "admin")) {
      throw new Error("Forbidden");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: adminRoles, error: adminRolesErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "admin");
    if (adminRolesErr) throw adminRolesErr;
    const adminIds = new Set(((adminRoles ?? []) as RoleRow[]).map((r) => r.user_id));

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
      if (!email || adminIds.has(u.id)) continue; // escludi admin
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

    // Snapshots di account eliminati (KPI restano completi).
    const { data: deleted, error: delErr } = await supabaseAdmin
      .from("deleted_demo_users")
      .select("*");
    if (delErr) throw delErr;
    for (const d of (deleted ?? []) as any[]) {
      rows.push({
        userId: `deleted:${d.id}`,
        email: d.email,
        businessName: d.business_name,
        phone: d.phone,
        createdAt: d.created_at_original,
        firstSeen: d.first_seen_ms != null ? Number(d.first_seen_ms) : null,
        lastSeen: d.last_seen_ms != null ? Number(d.last_seen_ms) : null,
        loginCount: Number(d.login_count ?? 0),
        totalMs: Number(d.total_ms ?? 0),
        trialStart: d.trial_start_ms != null ? Number(d.trial_start_ms) : null,
        counts: {
          clients: Number(d.clients_count ?? 0),
          products: Number(d.products_count ?? 0),
          orders: Number(d.orders_count ?? 0),
          deliveries: Number(d.deliveries_count ?? 0),
          receipts: Number(d.receipts_count ?? 0),
        },
        onboarding: d.onboarding ?? null,
        deleted: true,
        deletedAt: d.deleted_at,
      });
    }
    return { users: rows };
  });

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data: myRole, error: roleErr } = await context.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  if (roleErr) throw roleErr;
  if (!((myRole ?? []) as Pick<RoleRow, "role">[]).some((r) => r.role === "admin")) {
    throw new Error("Forbidden");
  }
}

export const deleteDemoUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => {
    if (!input?.userId || typeof input.userId !== "string") throw new Error("userId richiesto");
    return input;
  })
  .handler(async ({ data, context }) => {
    await assertAdmin(context as any);
    if (data.userId === context.userId) throw new Error("Non puoi eliminare il tuo account admin");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // safety: never delete another admin
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId)
      .eq("role", "admin");
    if ((targetRoles ?? []).length > 0) throw new Error("Non è possibile eliminare un account admin");

    // load auth user + state for snapshot
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    const { data: stateRow } = await supabaseAdmin
      .from("user_state")
      .select("data")
      .eq("user_id", data.userId)
      .maybeSingle();
    const stateData: any = (stateRow as any)?.data ?? {};
    const meta = (stateData.__demoMeta ?? {}) as Record<string, any>;
    const len = (k: string) => (Array.isArray(stateData?.[k]) ? stateData[k].length : 0);

    await supabaseAdmin.from("deleted_demo_users").insert({
      original_user_id: data.userId,
      email: authUser?.user?.email ?? null,
      business_name: meta?.onboarding?.businessName ?? authUser?.user?.user_metadata?.business_name ?? null,
      phone: meta?.onboarding?.phone ?? authUser?.user?.user_metadata?.phone ?? null,
      created_at_original: authUser?.user?.created_at ?? null,
      first_seen_ms: typeof meta.firstSeen === "number" ? meta.firstSeen : null,
      last_seen_ms: typeof meta.lastSeen === "number" ? meta.lastSeen : null,
      login_count: Number(meta.loginCount ?? 0),
      total_ms: Number(meta.totalMs ?? 0),
      trial_start_ms: typeof meta.trialStart === "number" ? meta.trialStart : null,
      clients_count: len("clients"),
      products_count: len("products"),
      orders_count: len("orders"),
      deliveries_count: len("deliveries"),
      receipts_count: len("casualSales"),
      onboarding: meta.onboarding ?? null,
      deleted_by: context.userId,
    });

    // cascade removes user_state, user_roles row, etc.
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw delErr;
    return { ok: true };
  });