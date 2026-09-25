import assert from "node:assert/strict";
import test from "node:test";
import {
  SPEECH_PITCH_MAX,
  SPEECH_PITCH_MIN,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_TEXT_MAX_LENGTH,
  clampSpeechText,
  describeVoiceSource,
  isSpeechSynthesisSupported,
  isSpeechTextWithinLimit,
  normalizeSpeechPitch,
  normalizeSpeechRate,
} from "../src/services/speechSynthesisService";
import {
  PLANNED_TOOL_REGISTRY,
  getToolById,
  getToolRunnerKind,
  getToolsForGroup,
} from "../src/registry/tools";

test("helpers de texto limitan longitud de forma segura", () => {
  assert.equal(clampSpeechText("hola", 10), "hola");
  assert.equal(clampSpeechText("a".repeat(6000)).length, SPEECH_TEXT_MAX_LENGTH);
  assert.equal(clampSpeechText("abc", 0), "");
  assert.equal(clampSpeechText("abc", -5), "");
  assert.equal(isSpeechTextWithinLimit("ok"), true);
  assert.equal(isSpeechTextWithinLimit("a".repeat(SPEECH_TEXT_MAX_LENGTH + 1)), false);
});

test("helpers de voz normalizan rate/pitch y describen el origen", () => {
  assert.equal(normalizeSpeechRate(1.5), 1.5);
  assert.equal(normalizeSpeechRate(10), SPEECH_RATE_MAX);
  assert.equal(normalizeSpeechRate(0), SPEECH_RATE_MIN);
  assert.equal(normalizeSpeechRate(Number.NaN), 1);
  assert.equal(normalizeSpeechPitch(-3), SPEECH_PITCH_MIN);
  assert.equal(normalizeSpeechPitch(9), SPEECH_PITCH_MAX);
  assert.equal(normalizeSpeechPitch(Number.NaN), 1);

  assert.equal(describeVoiceSource(true), "local");
  assert.equal(describeVoiceSource(false), "network");
  assert.equal(describeVoiceSource(undefined), "unknown");
});

test("SpeechSynthesis no está disponible en el entorno de pruebas (Node)", () => {
  assert.equal(isSpeechSynthesisSupported(), false);
});

test("text-to-speech es pública, CLIENT_ONLY y del runner speech", () => {
  const tool = getToolById("text-to-speech");
  assert.ok(tool, "text-to-speech debe existir");
  assert.equal(tool!.processingMode, "CLIENT_SIDE");
  assert.equal(Boolean(tool!.requiresServer), false);
  assert.equal(tool!.category, "audio");
  assert.equal(getToolRunnerKind(tool!), "speech");

  const groupIds = new Set(getToolsForGroup("audio-speech").map((item) => item.id));
  assert.equal(groupIds.has("text-to-speech"), true);
  assert.equal(
    PLANNED_TOOL_REGISTRY.some((item) => item.id === "text-to-speech"),
    false,
    "text-to-speech ya no debe estar planificada",
  );
});

test("speech-to-text permanece planificada y sin comportamiento real", () => {
  const planned = PLANNED_TOOL_REGISTRY.find((item) => item.id === "speech-to-text");
  assert.ok(planned, "speech-to-text debe seguir planificada");
  assert.equal(planned!.group, "audio-speech");
  assert.equal(getToolById("speech-to-text"), undefined);
});

test("las conversiones de audio del servidor se preservan y pertenecen a Audio & Speech", () => {
  const groupIds = new Set(getToolsForGroup("audio-speech").map((item) => item.id));
  for (const id of ["wav-to-mp3", "mp3-to-wav", "audio-bitrate", "audio-normalize", "audio-trimmer"]) {
    const tool = getToolById(id);
    assert.ok(tool, `${id} debe seguir disponible`);
    assert.equal(tool!.category, "audio", `${id} debe usar categoría audio`);
    assert.equal(groupIds.has(id), true, `${id} debe pertenecer a Audio & Speech`);
  }
  for (const id of ["wav-to-mp3", "mp3-to-wav", "audio-bitrate", "audio-normalize"]) {
    const tool = getToolById(id)!;
    assert.equal(tool.processingMode, "SERVER_SIDE", `${id} usa FFmpeg en servidor`);
    assert.equal(Boolean(tool.requiresServer), true, `${id} requiere backend`);
  }
});

test("video a audio del usuario se preserva vía backend, sin tocar proveedores", () => {
  for (const id of ["video-to-mp3", "video-to-wav"]) {
    const tool = getToolById(id);
    assert.ok(tool, `${id} debe seguir disponible`);
    assert.equal(tool!.processingMode, "SERVER_SIDE");
    assert.equal(Boolean(tool!.requiresServer), true);
    assert.equal(tool!.engine, "server-ffmpeg");
  }
});
