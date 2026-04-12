import { corsHeaders } from "@supabase/supabase-js/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const AZURE_SPEECH_KEY = Deno.env.get("AZURE_SPEECH_KEY");
    const AZURE_SPEECH_REGION = Deno.env.get("AZURE_SPEECH_REGION");

    if (!AZURE_SPEECH_KEY) {
      throw new Error("AZURE_SPEECH_KEY is not configured");
    }
    if (!AZURE_SPEECH_REGION) {
      throw new Error("AZURE_SPEECH_REGION is not configured");
    }

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

    // Convert webm to WAV using the audio data directly
    // Azure Speech REST API needs WAV format, but we'll send raw audio
    const audioBytes = await audioFile.arrayBuffer();
    const audioBuffer = new Uint8Array(audioBytes);

    // Create WAV header for 16kHz 16-bit mono PCM
    // We'll let Azure handle the webm format via content type
    const pronAssessmentParams = {
      ReferenceText: referenceText || "",
      GradingSystem: "HundredMark",
      Granularity: "FullText",
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
        Accept: "application/json;text/xml",
        Connection: "Keep-Alive",
        "Content-Type": "audio/webm; codecs=opus",
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

    // Extract scores from Azure response
    let scores = {
      pronunciation: 0,
      fluency: 0,
      grammar: 0,
      vocabulary: 0,
      prosody: 0,
      transcription: "",
    };

    if (result.RecognitionStatus === "Success" && result.NBest && result.NBest.length > 0) {
      const best = result.NBest[0];
      const pa = best.PronunciationAssessment || {};

      scores = {
        pronunciation: Math.round(pa.AccuracyScore || 0),
        fluency: Math.round(pa.FluencyScore || 0),
        grammar: Math.round(pa.CompletenessScore || 0),
        vocabulary: Math.round(pa.ProsodyScore || pa.CompletenessScore || 0),
        prosody: Math.round(pa.ProsodyScore || 0),
        transcription: best.Display || best.Lexical || "",
      };
    } else {
      console.error("Recognition failed:", result);
      return new Response(
        JSON.stringify({
          error: "Não foi possível reconhecer o áudio. Tente falar mais alto e claro.",
          rawResult: result,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify(scores), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in azure-pronunciation:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
