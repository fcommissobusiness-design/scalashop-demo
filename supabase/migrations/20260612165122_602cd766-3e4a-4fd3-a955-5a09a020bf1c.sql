CREATE TABLE public.deleted_demo_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_user_id uuid NOT NULL,
  email text,
  business_name text,
  phone text,
  created_at_original timestamptz,
  first_seen_ms bigint,
  last_seen_ms bigint,
  login_count integer NOT NULL DEFAULT 0,
  total_ms bigint NOT NULL DEFAULT 0,
  trial_start_ms bigint,
  clients_count integer NOT NULL DEFAULT 0,
  products_count integer NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  deliveries_count integer NOT NULL DEFAULT 0,
  receipts_count integer NOT NULL DEFAULT 0,
  onboarding jsonb,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by uuid
);

GRANT ALL ON public.deleted_demo_users TO service_role;

ALTER TABLE public.deleted_demo_users ENABLE ROW LEVEL SECURITY;

-- No policies for authenticated/anon: only service_role (server admin) can access.
