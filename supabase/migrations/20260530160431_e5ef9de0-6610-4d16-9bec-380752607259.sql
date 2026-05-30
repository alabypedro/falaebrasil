-- Ensure "Let's Falaê" and "My Questions" are available to everyone (all_tiers = true)
UPDATE public.fb_communities 
SET all_tiers = true 
WHERE access_key IN ('lets_falae', 'my_questions');

-- Create level-specific OPEN groups if they don't exist, and update them if they do
DO $$
BEGIN
    -- Group A1 OPEN
    IF NOT EXISTS (SELECT 1 FROM public.fb_communities WHERE access_key = 'a1_open') THEN
        INSERT INTO public.fb_communities (title, description, whatsapp_url, access_key, required_tier, all_tiers, sort_order)
        VALUES ('Grupo A1 OPEN', 'Comunidade de alunos nível A1 OPEN', 'https://chat.whatsapp.com/dummy-a1-open', 'a1_open', 'open', false, 10);
    ELSE
        UPDATE public.fb_communities 
        SET title = 'Grupo A1 OPEN', required_tier = 'open', all_tiers = false 
        WHERE access_key = 'a1_open';
    END IF;

    -- Group A2 OPEN
    IF NOT EXISTS (SELECT 1 FROM public.fb_communities WHERE access_key = 'a2_open') THEN
        INSERT INTO public.fb_communities (title, description, whatsapp_url, access_key, required_tier, all_tiers, sort_order)
        VALUES ('Grupo A2 OPEN', 'Comunidade de alunos nível A2 OPEN', 'https://chat.whatsapp.com/dummy-a2-open', 'a2_open', 'open', false, 20);
    ELSE
        UPDATE public.fb_communities 
        SET title = 'Grupo A2 OPEN', required_tier = 'open', all_tiers = false 
        WHERE access_key = 'a2_open';
    END IF;

    -- Group B1 OPEN
    IF NOT EXISTS (SELECT 1 FROM public.fb_communities WHERE access_key = 'b1_open') THEN
        INSERT INTO public.fb_communities (title, description, whatsapp_url, access_key, required_tier, all_tiers, sort_order)
        VALUES ('Grupo B1 OPEN', 'Comunidade de alunos nível B1 OPEN', 'https://chat.whatsapp.com/dummy-b1-open', 'b1_open', 'open', false, 30);
    ELSE
        UPDATE public.fb_communities 
        SET title = 'Grupo B1 OPEN', required_tier = 'open', all_tiers = false 
        WHERE access_key = 'b1_open';
    END IF;

    -- Group B2 OPEN
    IF NOT EXISTS (SELECT 1 FROM public.fb_communities WHERE access_key = 'b2_open') THEN
        INSERT INTO public.fb_communities (title, description, whatsapp_url, access_key, required_tier, all_tiers, sort_order)
        VALUES ('Grupo B2 OPEN', 'Comunidade de alunos nível B2 OPEN', 'https://chat.whatsapp.com/dummy-b2-open', 'b2_open', 'open', false, 40);
    ELSE
        UPDATE public.fb_communities 
        SET title = 'Grupo B2 OPEN', required_tier = 'open', all_tiers = false 
        WHERE access_key = 'b2_open';
    END IF;
END $$;
