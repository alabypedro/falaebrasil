-- Tabela para armazenar as inscrições de push
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    subscription_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice único para o endpoint dentro do JSONB
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_unique_endpoint 
ON public.push_subscriptions (user_id, (subscription_data->>'endpoint'));

-- Permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

-- Ativar RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS "Users can manage their own subscriptions" ON public.push_subscriptions; 
CREATE POLICY "Users can manage their own subscriptions" 
ON public.push_subscriptions 
FOR ALL 
USING (auth.uid() = user_id);

-- Adicionar campo de última atividade no perfil se não existir
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'last_activity') THEN
        ALTER TABLE public.profiles ADD COLUMN last_activity TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Atualizar updated_at
CREATE OR REPLACE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();