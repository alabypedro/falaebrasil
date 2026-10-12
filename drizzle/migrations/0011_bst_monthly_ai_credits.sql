CREATE TABLE public.bst_monthly_credit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  month_index integer NOT NULL,
  seconds_added integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_index)
);
GRANT SELECT ON public.bst_monthly_credit_log TO authenticated;
GRANT ALL ON public.bst_monthly_credit_log TO service_role;
ALTER TABLE public.bst_monthly_credit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bst credit log" ON public.bst_monthly_credit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users read own bst credit log" ON public.bst_monthly_credit_log FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Compradores BST: +1h/mês (IA Falaê) do 2º ao 12º mês após a 1ª compra; mês 1 = crédito da compra.
-- Saldo acumulado nunca passa de 12h; créditos não expiram; nada é adicionado a partir do 13º mês.
CREATE OR REPLACE FUNCTION public.grant_bst_monthly_credits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; _n integer := 0; _add integer;
BEGIN
  PERFORM set_config('app.bypass_profile_protection', 'on', true);
  FOR r IN
    SELECT a.user_id, m.idx, p.scripted_balance
    FROM (SELECT user_id, min(granted_at) AS first_buy FROM public.bst_product_access
          WHERE source = 'asaas' GROUP BY user_id) a
    JOIN public.profiles p ON p.user_id = a.user_id
    CROSS JOIN LATERAL generate_series(2, 12) AS m(idx)
    WHERE a.first_buy + make_interval(months => m.idx - 1) <= now()
      AND NOT public.has_open_category(a.user_id)
      AND NOT EXISTS (SELECT 1 FROM public.bst_monthly_credit_log l WHERE l.user_id = a.user_id AND l.month_index = m.idx)
    ORDER BY a.user_id, m.idx
  LOOP
    SELECT scripted_balance INTO r.scripted_balance FROM public.profiles WHERE user_id = r.user_id;
    _add := GREATEST(0, LEAST(3600, 43200 - COALESCE(r.scripted_balance, 0)));
    INSERT INTO public.bst_monthly_credit_log(user_id, month_index, seconds_added) VALUES (r.user_id, r.idx, _add);
    IF _add > 0 THEN
      UPDATE public.profiles SET scripted_balance = scripted_balance + _add WHERE user_id = r.user_id;
    END IF;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
END $$;
REVOKE ALL ON FUNCTION public.grant_bst_monthly_credits() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('bst-monthly-ai-credits', '15 9 * * *', $$select public.grant_bst_monthly_credits()$$);