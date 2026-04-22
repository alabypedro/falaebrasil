import { useState, useRef, useCallback } from "react";

const TARGET_SAMPLE_RATE = 16000;
const SILENCE_THRESHOLD = 0.005;
const SILENCE_PADDING_MS = 120;
const TARGET_PEAK = 0.72;
const MAX_GAIN = 4;

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function mergeAudioChunks(chunks: Float32Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }

  return merged;
}

function trimSilence(samples: Float32Array, sampleRate: number) {
  const padding = Math.floor((SILENCE_PADDING_MS / 1000) * sampleRate);

  let start = 0;
  while (start < samples.length && Math.abs(samples[start]) < SILENCE_THRESHOLD) {
    start += 1;
  }

  let end = samples.length - 1;
  while (end > start && Math.abs(samples[end]) < SILENCE_THRESHOLD) {
    end -= 1;
  }

  if (start >= end) {
    return samples;
  }

  return samples.slice(
    Math.max(0, start - padding),
    Math.min(samples.length, end + padding + 1)
  );
}

function applyAutomaticGain(samples: Float32Array) {
  let peak = 0;

  for (let i = 0; i < samples.length; i += 1) {
    peak = Math.max(peak, Math.abs(samples[i]));
  }

  if (!peak) {
    return samples;
  }

  const gain = clamp(TARGET_PEAK / peak, 0.35, MAX_GAIN);
  const adjusted = new Float32Array(samples.length);

  for (let i = 0; i < samples.length; i += 1) {
    adjusted[i] = Math.max(-1, Math.min(1, samples[i] * gain));
  }

  return adjusted;
}

function downsampleBuffer(buffer: Float32Array, inputSampleRate: number, outputSampleRate: number) {
  if (inputSampleRate <= outputSampleRate) {
    return buffer;
  }

  const ratio = inputSampleRate / outputSampleRate;
  const result = new Float32Array(Math.round(buffer.length / ratio));
  let resultOffset = 0;
  let bufferOffset = 0;

  while (resultOffset < result.length) {
    const nextBufferOffset = Math.round((resultOffset + 1) * ratio);
    let total = 0;
    let count = 0;

    for (let i = bufferOffset; i < nextBufferOffset && i < buffer.length; i += 1) {
      total += buffer[i];
      count += 1;
    }

    result[resultOffset] = count > 0 ? total / count : 0;
    resultOffset += 1;
    bufferOffset = nextBufferOffset;
  }

  return result;
}

function encodeWav(samples: Float32Array, sampleRate: number) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const value = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function getAudioLevel(samples: Float32Array) {
  let sumSquares = 0;

  for (let i = 0; i < samples.length; i += 1) {
    sumSquares += samples[i] * samples[i];
  }

  const rms = Math.sqrt(sumSquares / Math.max(samples.length, 1));
  const db = 20 * Math.log10(Math.max(rms, 0.00001));
  return clamp(((db + 55) / 50) * 100);
}

export interface Recording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: Date;
  transcription?: string;
  isTranscribing?: boolean;
}

export function useAudioRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const silentGainRef = useRef<GainNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const inputSampleRateRef = useRef<number>(TARGET_SAMPLE_RATE);
  const lastLevelUpdateRef = useRef<number>(0);

  const cleanupAudioGraph = useCallback(async () => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    silentGainRef.current?.disconnect();

    processorRef.current = null;
    sourceRef.current = null;
    silentGainRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;

    if (audioContext && audioContext.state !== "closed") {
      await audioContext.close().catch(() => undefined);
    }
  }, []);

  const finalizeRecording = useCallback(async () => {
    const capturedChunks = pcmChunksRef.current;
    const inputSampleRate = inputSampleRateRef.current;
    pcmChunksRef.current = [];

    await cleanupAudioGraph();
    setAudioLevel(0);

    if (!capturedChunks.length) {
      return;
    }

    const merged = mergeAudioChunks(capturedChunks);
    const trimmed = trimSilence(merged, inputSampleRate);
    const prepared = trimmed.length >= Math.max(sampleRateToSamples(inputSampleRate, 0.3), merged.length * 0.1)
      ? trimmed
      : merged;
    const adjusted = applyAutomaticGain(prepared);
    const resampled = downsampleBuffer(adjusted, inputSampleRate, TARGET_SAMPLE_RATE);
    const wavBuffer = encodeWav(resampled, TARGET_SAMPLE_RATE);
    const blob = new Blob([wavBuffer], { type: "audio/wav" });
    const url = URL.createObjectURL(blob);
    const duration = Math.max(1, Math.round(resampled.length / TARGET_SAMPLE_RATE));

    setRecordings((prev) => [
      {
        id: crypto.randomUUID(),
        blob,
        url,
        duration,
        timestamp: new Date(),
      },
      ...prev,
    ]);
  }, [cleanupAudioGraph]);

  const startRecording = useCallback(async () => {
    try {
      await cleanupAudioGraph();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: { ideal: 1 },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      streamRef.current = stream;

      const audioContext = new AudioContext({ latencyHint: "interactive" });
      await audioContext.resume();

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      const silentGain = audioContext.createGain();
      silentGain.gain.value = 0;

      pcmChunksRef.current = [];
      inputSampleRateRef.current = audioContext.sampleRate;
      lastLevelUpdateRef.current = 0;

      processor.onaudioprocess = (event) => {
        const channel = event.inputBuffer.getChannelData(0);
        pcmChunksRef.current.push(new Float32Array(channel));

        const now = performance.now();
        if (now - lastLevelUpdateRef.current >= 120) {
          lastLevelUpdateRef.current = now;
          setAudioLevel(getAudioLevel(channel));
        }
      };

      source.connect(processor);
      processor.connect(silentGain);
      silentGain.connect(audioContext.destination);

      audioContextRef.current = audioContext;
      sourceRef.current = source;
      processorRef.current = processor;
      silentGainRef.current = silentGain;

      startTimeRef.current = Date.now();
      setElapsed(0);
      setAudioLevel(0);
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch {
      alert("Permissão de microfone necessária para gravar áudio.");
    }
  }, [cleanupAudioGraph]);

  const stopRecording = useCallback(() => {
    if (!isRecording) return;

    setIsRecording(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    void finalizeRecording();
  }, [finalizeRecording, isRecording]);

  const deleteRecording = useCallback((id: string) => {
    setRecordings((prev) => {
      const rec = prev.find((r) => r.id === id);
      if (rec) URL.revokeObjectURL(rec.url);
      return prev.filter((r) => r.id !== id);
    });
  }, []);

  return {
    isRecording,
    recordings,
    elapsed,
    audioLevel,
    startRecording,
    stopRecording,
    deleteRecording,
  };
}

function sampleRateToSamples(sampleRate: number, seconds: number) {
  return Math.floor(sampleRate * seconds);
}
