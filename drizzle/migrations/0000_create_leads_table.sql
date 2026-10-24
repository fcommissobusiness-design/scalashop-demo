CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  nome text,
  cognome text,
  attivita text,
  email text,
  telefono text,
  fonte text
);

GRANT INSERT ON public.leads TO anon;
GRANT ALL ON public.leads TO service_role;

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon to insert leads"
ON public.leads
FOR INSERT
TO anon
WITH CHECK (true);