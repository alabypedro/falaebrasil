
-- Create contracts table
CREATE TABLE IF NOT EXISTS public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier TEXT NOT NULL UNIQUE CHECK (tier IN ('open','pro','vip','kids','teens')),
  title TEXT NOT NULL,
  file_path TEXT,
  file_name TEXT,
  updated_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view contracts" ON public.contracts;
CREATE POLICY "Anyone authenticated can view contracts"
ON public.contracts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can insert contracts" ON public.contracts;
CREATE POLICY "Admins can insert contracts"
ON public.contracts FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update contracts" ON public.contracts;
CREATE POLICY "Admins can update contracts"
ON public.contracts FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete contracts" ON public.contracts;
CREATE POLICY "Admins can delete contracts"
ON public.contracts FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE TRIGGER update_contracts_updated_at
BEFORE UPDATE ON public.contracts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the 5 tiers
INSERT INTO public.contracts (tier, title) VALUES
  ('open', 'Contrato Modelo OPEN'),
  ('pro', 'Contrato Modelo PRO'),
  ('vip', 'Contrato Modelo VIP'),
  ('teens', 'Contrato Modelo TEENS'),
  ('kids', 'Contrato Modelo KIDS');

-- Create storage bucket for contracts (public so users can download)
INSERT INTO storage.buckets (id, name, public) VALUES ('contracts', 'contracts', true);

CREATE POLICY "Public can read contracts"
ON storage.objects FOR SELECT
USING (bucket_id = 'contracts');

CREATE POLICY "Admins can upload contracts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update contracts files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete contracts files"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'contracts' AND public.has_role(auth.uid(), 'admin'::app_role));
