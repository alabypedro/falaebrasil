CREATE OR REPLACE FUNCTION public.recharge_monthly_tokens()
RETURNS void AS $$
DECLARE
    _users_count INTEGER;
BEGIN
    -- Bypass the security trigger by setting a session variable
    SET LOCAL app.bypass_profile_protection = 'on';

    -- Recarga de 1800s (30 min) para cada modalidade
    -- Apenas para alunos que têm acesso a cursos e estão com assinatura ativa ou no plano baseline (OPEN/PRO/VIP)
    UPDATE public.profiles
    SET 
        scripted_balance = scripted_balance + 1800,
        unscripted_balance = unscripted_balance + 1800
    WHERE 
        has_course_access = true 
        AND (
            subscription_status = 'active' 
            OR subscription_status = 'past_due' 
            OR plan_tier IN ('open', 'pro', 'vip')
        );

    GET DIAGNOSTICS _users_count = ROW_COUNT;

    -- Registrar no log
    INSERT INTO public.token_recharge_log (year, month, users_count, scripted_amount, unscripted_amount)
    VALUES (
        EXTRACT(YEAR FROM now())::INTEGER,
        EXTRACT(MONTH FROM now())::INTEGER,
        _users_count,
        1800,
        1800
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Since the June 1st recharge failed, run it manually now to fix the current month's credits.
-- We check if it already ran successfully for June 2026 to avoid double charging if this is re-run.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.token_recharge_log 
        WHERE year = 2026 AND month = 6
    ) THEN
        PERFORM public.recharge_monthly_tokens();
    END IF;
END $$;
