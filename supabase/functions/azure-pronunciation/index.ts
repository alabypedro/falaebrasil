const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Simple WAV header writer for 16-bit mono PCM
function createWavHeader(dataLength: number, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true);  // PCM
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);  // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  return new Uint8Array(header);
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

    // Handle InitialSilenceTimeout gracefully
    if (result.RecognitionStatus === "InitialSilenceTimeout" || 
        result.RecognitionStatus === "NoMatch" ||
        result.RecognitionStatus === "BabbleTimeout") {
      console.warn("Recognition issue:", result.RecognitionStatus);
      return new Response(
        JSON.stringify({
          error: "AUDIO_UNRECOGNIZED",
          message: "Não foi possível reconhecer o áudio. Tente falar mais alto e claro.",
          fallback: true,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
      const transcription = (best.Display || best.Lexical || "").trim();

      scores = {
        pronunciation: Math.round(pa.AccuracyScore || 0),
        fluency: Math.round(pa.FluencyScore || 0),
        grammar: Math.round(pa.CompletenessScore || 0),
        vocabulary: Math.round(pa.ProsodyScore || pa.CompletenessScore || 0),
        prosody: Math.round(pa.ProsodyScore || 0),
        transcription,
      };

      const hasRecognizedSpeech = /[\p{L}\p{N}]/u.test(transcription);
      const allScoresZero = [
        scores.pronunciation,
        scores.fluency,
        scores.grammar,
        scores.vocabulary,
        scores.prosody,
      ].every((score) => score === 0);

      if (!hasRecognizedSpeech || allScoresZero) {
        return new Response(
          JSON.stringify({
            error: "AUDIO_UNRECOGNIZED",
            message: "O áudio foi captado, mas a fala não ficou nítida o suficiente. Tente falar um pouco mais perto do microfone; o app agora ajusta automaticamente o volume para evitar distorção.",
            fallback: true,
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else {
      console.error("Recognition failed:", result);
      return new Response(
        JSON.stringify({
          error: "AUDIO_UNRECOGNIZED",
          message: "Não foi possível reconhecer o áudio. Tente novamente.",
          fallback: true,
        }),
        {
          status: 200,
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
    return new Response(JSON.stringify({ error: message, fallback: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
