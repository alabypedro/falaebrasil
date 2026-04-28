-- 1) Remove all Google identities
DELETE FROM auth.identities WHERE provider = 'google';

-- 2) Remove users that no longer have any identity (i.e. were Google-only)
DELETE FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM auth.identities i WHERE i.user_id = u.id
);