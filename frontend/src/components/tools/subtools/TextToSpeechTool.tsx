import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Lock, Pause, Play, Square, Volume2 } from 'lucide-react';
import { ToolDefinition } from '../../../types';
import {
  SPEECH_PITCH_MAX,
  SPEECH_PITCH_MIN,
  SPEECH_RATE_MAX,
  SPEECH_RATE_MIN,
  SPEECH_TEXT_MAX_LENGTH,
  clampSpeechText,
  describeVoiceSource,
  isSpeechSynthesisSupported,
  normalizeSpeechPitch,
  normalizeSpeechRate,
} from '../../../services/speechSynthesisService';

export const TextToSpeechTool: React.FC<{ tool: ToolDefinition }> = () => {
  const supported = useMemo(() => isSpeechSynthesisSupported(), []);
  const [text, setText] = useState(
    'Hola, esto es una demostración de texto a voz ejecutada por tu navegador.',
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [status, setStatus] = useState<'idle' | 'speaking' | 'paused'>('idle');

  useEffect(() => {
    if (!supported) return;
    const synth = window.speechSynthesis;
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener?.('voiceschanged', load);
    return () => {
      synth.removeEventListener?.('voiceschanged', load);
      synth.cancel();
    };
  }, [supported]);

  const selectedVoice = voices.find((voice) => voice.voiceURI === voiceURI) || null;
  const sourceLabel =
    describeVoiceSource(selectedVoice?.localService) === 'local'
      ? 'voz local del dispositivo'
      : describeVoiceSource(selectedVoice?.localService) === 'network'
        ? 'voz en línea del navegador'
        : 'origen de voz no especificado por el navegador';

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = () => {
    if (!supported) return;
    const content = clampSpeechText(text).trim();
    if (!content) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    }
    utterance.rate = normalizeSpeechRate(rate);
    utterance.pitch = normalizeSpeechPitch(pitch);
    utterance.onstart = () => setStatus('speaking');
    utterance.onend = () => setStatus('idle');
    utterance.onerror = () => setStatus('idle');
    utteranceRef.current = utterance;
    synth.speak(utterance);
  };

  const pause = () => {
    if (supported && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setStatus('paused');
    }
  };
  const resume = () => {
    if (supported && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setStatus('speaking');
    }
  };
  const stop = () => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setStatus('idle');
  };

  if (!supported) {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-amber-500/20 bg-[#101218] p-6">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div>
          <h3 className="text-sm font-semibold text-white">Texto a voz no disponible</h3>
          <p className="mt-1 text-xs text-slate-400">
            Tu navegador no expone la síntesis de voz. Prueba con una versión reciente de Chrome, Edge,
            Safari o Firefox en escritorio o móvil.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-4 rounded-2xl border border-white/[0.08] bg-[#101218] p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">Texto a leer</label>
          <textarea
            rows={8}
            value={text}
            maxLength={SPEECH_TEXT_MAX_LENGTH}
            onChange={(e) => setText(e.target.value)}
            className="w-full resize-y rounded-xl border border-white/[0.08] bg-[#08090D] px-3.5 py-2.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
          />
          <p className="mt-1 text-[11px] text-slate-500">
            {text.length}/{SPEECH_TEXT_MAX_LENGTH} caracteres
          </p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-300">Voz</label>
          <select
            value={voiceURI}
            onChange={(e) => setVoiceURI(e.target.value)}
            className="w-full rounded-xl border border-white/[0.08] bg-[#08090D] px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Voz predeterminada del navegador</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} — {voice.lang}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-slate-500">
            {voices.length} voz/voces detectadas · {sourceLabel}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="text-xs text-slate-300">
            Velocidad {rate.toFixed(2)}×
            <input
              type="range"
              min={SPEECH_RATE_MIN}
              max={SPEECH_RATE_MAX}
              step={0.05}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
              className="mt-1 w-full accent-indigo-500"
            />
          </label>
          <label className="text-xs text-slate-300">
            Tono {pitch.toFixed(2)}
            <input
              type="range"
              min={SPEECH_PITCH_MIN}
              max={SPEECH_PITCH_MAX}
              step={0.05}
              value={pitch}
              onChange={(e) => setPitch(Number(e.target.value))}
              className="mt-1 w-full accent-indigo-500"
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-[#101218] p-6">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Volume2 className="h-4 w-4 text-indigo-400" /> Reproducción
        </h3>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={speak}
            disabled={!text.trim()}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-40"
          >
            <Play className="h-4 w-4" /> Reproducir
          </button>
          <button
            onClick={pause}
            disabled={status !== 'speaking'}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <Pause className="h-4 w-4" /> Pausar
          </button>
          <button
            onClick={resume}
            disabled={status !== 'paused'}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-800 px-4 text-xs font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
          >
            <Play className="h-4 w-4" /> Reanudar
          </button>
          <button
            onClick={stop}
            disabled={status === 'idle'}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-rose-600/80 px-4 text-xs font-semibold text-white hover:bg-rose-600 disabled:opacity-40"
          >
            <Square className="h-4 w-4" /> Detener
          </button>
        </div>

        <p className="rounded-xl border border-white/[0.06] bg-[#08090D] p-3 text-[11px] text-slate-400">
          La pausa/reanudación y las voces disponibles dependen del navegador y del sistema operativo.
        </p>

        <p className="text-[11px] text-amber-200/90">
          Esta herramienta solo reproduce texto en voz alta. No genera un archivo MP3 o WAV descargable.
        </p>

        <p className="flex items-start gap-1.5 text-[11px] text-emerald-400">
          <Lock className="mt-0.5 h-3 w-3 shrink-0" />
          El texto no se envía a VELYXORA. La síntesis la realiza tu navegador; según la voz elegida puede
          usar una voz local del dispositivo o una voz en línea del propio navegador.
        </p>
      </div>
    </div>
  );
};
