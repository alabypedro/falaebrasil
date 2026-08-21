ALTER TABLE public.leiae_texts DROP CONSTRAINT IF EXISTS leiae_texts_level_check;
ALTER TABLE public.leiae_texts ADD CONSTRAINT leiae_texts_level_check CHECK (level = ANY (ARRAY['A1','A2','B1','B2','C1','C2','T1','T2','T3','T4','K1','K2','K3','K4','M0']));
ALTER TABLE public.bst_voice_scripts DROP CONSTRAINT IF EXISTS bst_voice_scripts_level_check;
ALTER TABLE public.bst_voice_scripts ADD CONSTRAINT bst_voice_scripts_level_check CHECK (level = ANY (ARRAY['A1','A2','B1','B2','C1','C2','T1','T2','T3','T4','K1','K2','K3','K4','M0']));