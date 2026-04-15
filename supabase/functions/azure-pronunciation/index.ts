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
    const AZURE_SPEECH_KEY = Deno.env.get("AZURE_SPEECH_KEY");
    const AZURE_SPEECH_REGION = Deno.env.get("AZURE_SPEECH_REGION");

    if (!AZURE_SPEECH_KEY) throw new Error("AZURE_SPEECH_KEY is not configured");
    if (!AZURE_SPEECH_REGION) throw new Error("AZURE_SPEECH_REGION is not configured");

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File | null;
    const referenceText = formData.get("referenceText") as string | null;
    const language = (formData.get("language") as string) || "en-US";

    if (!audioFile) {
      return new Response(JSON.stringify({ error: "No audio file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const audioBytes = await audioFile.arrayBuffer();
    const audioBuffer = new Uint8Array(audioBytes);
    console.log(`Audio received: ${audioBuffer.length} bytes, type: ${audioFile.type}, name: ${audioFile.name}`);

    const pronAssessmentParams = {
      ReferenceText: referenceText || "",
      GradingSystem: "HundredMark",
      Granularity: "Word",
      Dimension: "Comprehensive",
      EnableMiscue: true,
      EnableProsodyAssessment: true,
    };

    const pronAssessmentHeader = btoa(JSON.stringify(pronAssessmentParams));
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
    console.log("Azure RecognitionStatus:", result.RecognitionStatus);

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
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If Success, always return the data — even if scores are low
    if (result.RecognitionStatus === "Success" && result.NBest && result.NBest.length > 0) {
      const best = result.NBest[0];
      const pa = best.PronunciationAssessment || result.PronunciationAssessment || {};
      const transcription = (best.Display || best.Lexical || "").trim();
      const accuracyScore = toNullableScore(pa.AccuracyScore);
      const fluencyScore = toNullableScore(pa.FluencyScore);
      const completenessScore = toNullableScore(pa.CompletenessScore);
      const prosodyScore = toNullableScore(pa.ProsodyScore);
      const pronunciationScore = toNullableScore(pa.PronunciationScore ?? pa.PronScore);
      const confidence = typeof best.Confidence === "number" && Number.isFinite(best.Confidence)
        ? Math.round(best.Confidence * 100)
        : null;
      const snr = toNullableScore(result.SNR);

      const missingScores = [
        accuracyScore == null ? "AccuracyScore" : null,
        fluencyScore == null ? "FluencyScore" : null,
        prosodyScore == null ? "ProsodyScore" : null,
        completenessScore == null ? "CompletenessScore" : null,
        pronunciationScore == null ? "PronunciationScore" : null,
      ].filter((scoreName): scoreName is string => Boolean(scoreName));

      const scores = {
        status: result.RecognitionStatus,
        transcription,
        confidence,
        snr,
        pronunciation: accuracyScore,
        accuracyScore,
        fluency: fluencyScore,
        fluencyScore,
        completeness: completenessScore,
        completenessScore,
        prosody: prosodyScore,
        prosodyScore,
        pronScore: pronunciationScore,
        pronunciationScore,
        // Keep backwards-compatible fields
        grammar: completenessScore,
        vocabulary: prosodyScore,
        missingScores,
      };

      console.log("Returning scores:", JSON.stringify(scores));

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
