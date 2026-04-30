-- Corrige as chaves de acesso dos itens da Biblioteca BST.
-- Antes estavam todos como 'free', o que liberava o conteúdo para qualquer usuário.
-- Cada par (ebook + audiobook) é vinculado ao seu Order Bump correspondente.

UPDATE public.library_bst
SET access_key = 'ebook1'
WHERE title IN ('Ebook Anfitrião Soberano', 'Audiobook Anfitrião Soberano');

UPDATE public.library_bst
SET access_key = 'ebook2'
WHERE title IN ('Ebook O Decodificador de Gringo', 'Audiobook O Decodificador de Gringo');

UPDATE public.library_bst
SET access_key = 'ebook3'
WHERE title IN ('Ebook O Vocabulário de Poder', 'Audiobook O Vocabulário de Poder');