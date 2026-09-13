import React, { useState } from 'react';
import { Settings, Shield, Sliders, Moon, Globe, Trash2, CheckCircle2 } from 'lucide-react';
import { settingsService } from '../../services/settingsService';
import { historyService } from '../../services/historyService';
import { UserSettings } from '../../types';
import { toast } from '../common/ToastContainer';

export const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings());

  const handleChange = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
    const updated = settingsService.saveSettings({ [key]: value });
    setSettings(updated);
    toast.success('Configuración actualizada');
  };

  const handleClearAllData = () => {
    historyService.clearHistory();
    localStorage.removeItem('velyxora_favorites_v1');
    toast.info('Todos los datos locales de VELYXORA han sido limpiados.');
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-white/[0.08]">
        <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Configuración & Preferencias</h2>
          <p className="text-xs text-slate-400">
            Ajustes de rendimiento, valores predeterminados y privacidad de la aplicación.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {/* General & UI */}
        <div className="p-5 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" /> General & Apariencia
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Idioma / Language</label>
              <select
                value={settings.language}
                onChange={(e) => handleChange('language', e.target.value as 'es' | 'en')}
                className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none"
              >
                <option value="es">Español (ES)</option>
                <option value="en">English (US)</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-slate-400 block mb-1.5">Tema de Interfaz</label>
              <select
                value={settings.theme}
                onChange={(e) => handleChange('theme', e.target.value as 'dark' | 'light' | 'system')}
                className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none"
              >
                <option value="dark">Dark First (#08090D) [Recomendado]</option>
                <option value="system">Sistema automático</option>
              </select>
            </div>
          </div>
        </div>

        {/* Media Defaults */}
        <div className="p-5 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-4">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-3.5 h-3.5" /> Parámetros por Defecto de Procesamiento
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs text-slate-300 mb-1">
                <span>Calidad predeterminada de imágenes (JPEG / WebP)</span>
                <span className="font-mono text-indigo-400 font-bold">{settings.imageQuality}%</span>
              </div>
              <input
                type="range"
                min={50}
                max={100}
                value={settings.imageQuality}
                onChange={(e) => handleChange('imageQuality', Number(e.target.value))}
                className="w-full accent-indigo-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Bitrate de audio por defecto</label>
                <select
                  value={settings.audioBitrate}
                  onChange={(e) => handleChange('audioBitrate', e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none"
                >
                  <option value="128k">128 kbps (Ligero)</option>
                  <option value="192k">192 kbps (Estándar)</option>
                  <option value="256k">256 kbps (Alta Fidelidad)</option>
                  <option value="320k">320 kbps (Máxima Calidad)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5">Resolución preferida de video</label>
                <select
                  value={settings.videoQuality}
                  onChange={(e) => handleChange('videoQuality', e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs text-white focus:outline-none"
                >
                  <option value="original">Resolución nativa</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Privacy & Performance */}
        <div className="p-5 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Shield className="w-3.5 h-3.5" /> Privacidad & Rendimiento
          </h3>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#08090D] border border-white/[0.05] cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-white">Priorizar procesamiento 100% local</p>
              <p className="text-[11px] text-slate-400">
                Evita conexiones de red cuando las herramientas puedan ejecutarse en el navegador con Canvas y Web Audio.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.preferLocalProcessing}
              onChange={(e) => handleChange('preferLocalProcessing', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-[#08090D] border border-white/[0.05] cursor-pointer">
            <div>
              <p className="text-xs font-semibold text-white">Modo de animaciones reducidas</p>
              <p className="text-[11px] text-slate-400">
                Desactiva transiciones complejas para teléfonos de gama baja o preferencias de accesibilidad.
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => handleChange('reducedMotion', e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
          </label>
        </div>

        {/* Data Reset */}
        <div className="p-5 rounded-2xl bg-[#101218] border border-rose-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-semibold text-rose-300">Borrar datos locales y caché</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Elimina el historial, los favoritos y las configuraciones guardadas en tu navegador.
            </p>
          </div>
          <button
            onClick={handleClearAllData}
            className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Restablecer VELYXORA</span>
          </button>
        </div>
      </div>
    </div>
  );
};
