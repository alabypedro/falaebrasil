import { useCallback, useState } from "react";
import * as ImmersiveReader from "@microsoft/immersive-reader-sdk";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { awardAiXp } from "@/lib/aiXp";

export interface LeiaeChunk {
  /** Título curto do trecho (ex.: "Unit 3 — Vocabulário") */
  title: string;
  /** Texto que será lido de forma interativa */
  content: string;
  /** Idioma do conteúdo. Padrão: en (curso Falaê Brasil) */
  lang?: string;
  /** MIME. Padrão: text/plain. Use text/html se o content tem tags. */
  mimeType?: "text/plain" | "text/html";
}

interface TokenResponse {
  token: string;
  subdomain: string;
}

/**
 * Hook para abrir a IA Leiaê (Azure Immersive Reader).
 * A IA quebra textos técnicos e permite ao aluno:
 *  - clicar em qualquer palavra para tradução instantânea (PT-BR)
 *  - ver divisão silábica e classes gramaticais
 *  - ouvir a pronúncia palavra por palavra
 *  - visualizar imagens de suporte (Picture Dictionary)
 */
export function useLeiae(uiLang: "pt-BR" | "en" = "pt-BR") {
  const [loading, setLoading] = useState(false);

  const open = useCallback(
    async (chunks: LeiaeChunk[]) => {
      if (!chunks?.length) return;
      setLoading(true);
      try {
        const totalWords = chunks.reduce(
          (n, c) => n + (c.content?.trim().split(/\s+/).length || 0),
          0,
        );
        // ~180 wpm reading; require 55% of estimated time to consider "read to the end"
        const requiredMs = Math.max(15_000, Math.round((totalWords / 180) * 60_000 * 0.55));
        const openedAt = Date.now();
        const readKey = `leiae:${chunks[0]?.title || "custom"}:${new Date().toISOString().slice(0,10)}`;

        const { data, error } = await supabase.functions.invoke<TokenResponse>(
          "immersive-reader-token",
          { body: {} },
        );
        if (error || !data?.token || !data?.subdomain) {
          throw new Error(error?.message || "Falha ao obter token da IA Leiaê");
        }

        await ImmersiveReader.launchAsync(
          data.token,
          data.subdomain,
          {
            title: chunks[0]?.title ?? "IA Leiaê",
            chunks: chunks.map((c) => ({
              content: c.content,
              lang: c.lang ?? "en",
              mimeType: c.mimeType ?? "text/plain",
            })),
          },
          {
            uiLang,
            timeout: 20000,
            uiZIndex: 2000,
            onExit: () => {
              const elapsed = Date.now() - openedAt;
              if (elapsed >= requiredMs) {
                awardAiXp("leiae", 25, readKey).then((r) => {
                  if (r?.awarded) toast.success("+25 XP · leitura concluída!");
                });
              } else {
                // Participação: 5 XP por sessão iniciada (uma vez por texto/dia)
                awardAiXp("leiae", 5, `${readKey}:open`);
              }
            },
          },
        );
      } catch (err) {
        console.error("IA Leiaê error", err);
        toast.error(
          err instanceof Error
            ? `IA Leiaê: ${err.message}`
            : "Não foi possível abrir a IA Leiaê",
        );
      } finally {
        setLoading(false);
      }
    },
    [uiLang],
  );

  return { open, loading };
}