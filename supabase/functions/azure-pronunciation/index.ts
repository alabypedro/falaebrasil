import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function toNullableScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 10) / 10
    : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ---- AUTH GUARD ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const AZURE_SPEECH_KEY = Deno.env.get("AZURE_SPEECH_KEY");
    const AZURE_SPEECH_REGION = Deno.env.get("AZURE_SPEECH_REGION");

    if (!AZURE_SPEECH_KEY) throw new Error("AZURE_SPEECH_KEY is not configured");
    if (!AZURE_SPEECH_REGION) throw new Error("AZURE_SPEECH_REGION is not configured");

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const referenceText = formData.get("referenceText") as string | null;
    const language = (formData.get("language") as string) || "en-US";
    const modeRaw = (formData.get("mode") as string | null)?.toLowerCase();
    const mode: "scripted" | "unscripted" =
      modeRaw === "unscripted" ? "unscripted" : "scripted";

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Enforce maximum upload size (10 MB) to protect Azure quota and edge resources
    const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
    if (audioFile.size > MAX_AUDIO_BYTES) {
      return new Response(
        JSON.stringify({ error: "Audio file too large (max 10 MB)" }),
        {
          status: 413,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Validate MIME type — accept common browser-recorded audio formats
    const allowedTypes = ["audio/wav", "audio/wave", "audio/x-wav", "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4"];
    if (audioFile.type && !allowedTypes.some((t) => audioFile.type.startsWith(t))) {
      return new Response(
        JSON.stringify({ error: `Unsupported audio type: ${audioFile.type}` }),
        {
          status: 415,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const audioBytes = await audioFile.arrayBuffer();
    const audioBuffer = new Uint8Array(audioBytes);
    console.log(`Audio received: ${audioBuffer.length} bytes, type: ${audioFile.type}, name: ${audioFile.name}`);

    // ---- CREDIT CHECK (per mode) ----
    // Check the relevant balance BEFORE calling Azure to avoid wasted API spend.
    const balanceColumn = mode === "unscripted" ? "unscripted_balance" : "scripted_balance";
    const { data: profileRow, error: profileErr } = await supabase
      .from("profiles")
      .select(balanceColumn)
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileErr) {
      console.error(`Failed to read ${balanceColumn}:`, profileErr);
    }

    const currentBalance = (profileRow as Record<string, number> | null)?.[balanceColumn] ?? 0;
    if (currentBalance <= 0) {
      const label = mode === "unscripted" ? "Unscripted" : "Scripted";
      return new Response(
        JSON.stringify({
          error: "INSUFFICIENT_CREDITS",
          credit_type: mode,
          message: `Saldo de prática ${label} esgotado. Adquira novos módulos para continuar praticando.`,
          fallback: true,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const pronAssessmentParams = {
      ReferenceText: referenceText || "",
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      EnableProsodyAssessment: true,
    };

    // Encode as base64 of UTF-8 bytes.
    // We use a robust method to avoid "characters outside of the Latin1 range" errors
    // that can happen with btoa() when dealing with certain Unicode characters.
    const pronAssessmentJson = JSON.stringify(pronAssessmentParams);
    const pronAssessmentBytes = new TextEncoder().encode(pronAssessmentJson);
    
    // Using a manual base64 conversion or a robust built-in if available.
    // In Deno, we can use the following approach which is safe for all bytes:
    const pronAssessmentHeader = btoa(String.fromCharCode(...pronAssessmentBytes));
    const sessionId = crypto.randomUUID().replace(/-/g, "");
    const url = `https://${AZURE_SPEECH_REGION}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${language}&format=detailed&X-ConnectionId=${sessionId}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        Connection: "Keep-Alive",
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        "Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY,
        "Pronunciation-Assessment": pronAssessmentHeader,
      },
      body: audioBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Azure API error [${response.status}]:`, errorText);
      throw new Error(`Azure Speech API error [${response.status}]: ${errorText}`);
    }

    const result = await response.json();
    console.log(JSON.stringify(result));
    console.log("Azure raw response:", JSON.stringify(result));
    console.log("Azure RecognitionStatus:", result.RecognitionStatus);

    // ---- DEBIT SECONDS (per mode) ----
    // Estimate audio duration from NBest[0].Duration (100-ns units) when available;
    // fall back to a minimum of 1 second so each call always debits something.
    let durationSeconds = 1;
    try {
      const nbestDuration = result?.NBest?.[0]?.Duration ?? result?.Duration;
      if (typeof nbestDuration === "number" && nbestDuration > 0) {
        durationSeconds = Math.max(1, Math.ceil(nbestDuration / 10_000_000));
      }
    } catch (_) { /* ignore */ }

    const debitRpc = mode === "unscripted" ? "debit_unscripted_seconds" : "debit_scripted_seconds";
    const { data: debitResult, error: debitErr } = await supabase.rpc(debitRpc, {
      _seconds: durationSeconds,
    });
    if (debitErr) {
      console.error(`${debitRpc} failed:`, debitErr);
    } else {
      console.log(`Debited ${mode} seconds:`, debitResult);
    }

    // Handle clear failures
    if (result.RecognitionStatus === "InitialSilenceTimeout" ||
        result.RecognitionStatus === "NoMatch" ||
        result.RecognitionStatus === "BabbleTimeout") {
      return new Response(
        JSON.stringify({
          status: result.RecognitionStatus,
          error: "AUDIO_UNRECOGNIZED",
          message: "Não foi possível reconhecer o áudio. Tente falar mais alto e claro.",
          fallback: true,
          credit_debited_seconds: durationSeconds,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If Success, extract scores strictly from NBest[0].PronunciationAssessment
    if (result.RecognitionStatus === "Success" && result.NBest && result.NBest.length > 0) {
      const best = result.NBest[0];
      const pa = best.PronunciationAssessment || result.PronunciationAssessment || {};
      const missingScoreFields: string[] = [];

      console.log("PronunciationAssessment payload:", JSON.stringify(pa));

      const transcription = (best.Display || best.Lexical || "").trim();

      // Extract each score as a plain number; fallback to 0 if missing and log it
      const pickScore = (fieldName: string, ...candidates: unknown[]): number => {
        for (const candidate of candidates) {
          const normalized = toNullableScore(candidate);
          if (normalized != null) {
            return normalized;
          }
        }

        console.warn(`[azure-pronunciation] Missing score field: ${fieldName} — defaulting to 0`);
        missingScoreFields.push(fieldName);
        return 0;
      };

      const accuracy = pickScore(
        "AccuracyScore",
        pa.AccuracyScore,
        best.AccuracyScore,
        result.AccuracyScore,
      );
      const fluency = pickScore(
        "FluencyScore",
        pa.FluencyScore,
        best.FluencyScore,
        result.FluencyScore,
      );
      const completeness = pickScore(
        "CompletenessScore",
        pa.CompletenessScore,
        best.CompletenessScore,
        result.CompletenessScore,
      );
      const prosody = pickScore(
        "ProsodyScore",
        pa.ProsodyScore,
        best.ProsodyScore,
        result.ProsodyScore,
      );
      const pronunciation = pickScore(
        "PronunciationScore",
        pa.PronunciationScore,
        pa.PronScore,
        best.PronunciationScore,
        best.PronScore,
        result.PronunciationScore,
        result.PronScore,
      );

      const confidence = typeof best.Confidence === "number" && Number.isFinite(best.Confidence)
        ? Math.round(best.Confidence * 100)
        : 0;
      const snr = toNullableScore(result.SNR);

      const scores = {
        status: result.RecognitionStatus,
        transcription,
        confidence,
        snr,
        // Primary normalized fields (simple numbers, never null)
        accuracy,
        fluency,
        completeness,
        prosody,
        pronunciation, // overall score (0-100)
        missingScoreFields,
        credit_debited_seconds: durationSeconds,
      };

      console.log("Returning normalized scores:", JSON.stringify(scores));

      return new Response(JSON.stringify(scores), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fallback for unexpected status
    console.error("Unexpected recognition result:", JSON.stringify(result).substring(0, 500));
    return new Response(
      JSON.stringify({
        status: result.RecognitionStatus || "Unknown",
        error: "AUDIO_UNRECOGNIZED",
        message: "Não foi possível processar o áudio. Tente novamente.",
        fallback: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in azure-pronunciation:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message, fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
