CREATE OR REPLACE VIEW public.xp_ranking
WITH (security_invoker = true) AS
WITH ai AS (
  SELECT user_id, COALESCE(SUM(points), 0)::int AS ai_xp
  FROM public.ai_xp_events
  GROUP BY user_id
)
SELECT p.user_id,
       p.display_name,
       p.avatar_url,
       p.level,
       (p.xp + COALESCE(a.ai_xp, 0))::int AS total_xp,
       p.user_type,
       rank() OVER (ORDER BY (p.xp + COALESCE(a.ai_xp, 0)) DESC) AS rank_position
FROM public.profiles p
LEFT JOIN ai a ON a.user_id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = p.user_id AND r.role = ANY (ARRAY['admin'::app_role, 'teacher'::app_role])
)
ORDER BY (p.xp + COALESCE(a.ai_xp, 0)) DESC;