CREATE OR REPLACE VIEW public.xp_ranking AS
SELECT user_id,
       display_name,
       avatar_url,
       level,
       xp AS total_xp,
       user_type,
       rank() OVER (ORDER BY xp DESC) AS rank_position
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_roles r
  WHERE r.user_id = p.user_id AND r.role IN ('admin', 'teacher')
)
ORDER BY xp DESC;