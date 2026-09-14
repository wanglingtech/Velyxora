import React, { useState } from "react";
import { ArrowLeft, RotateCcw, Settings } from "lucide-react";
import { settingsService } from "../../services/settingsService";
import { UserSettings } from "../../types";
import { toast } from "../common/ToastContainer";

export const SettingsView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [settings, setSettings] = useState<UserSettings>(settingsService.getSettings());
  const change = <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => { setSettings(settingsService.updateSettings({ [key]: value })); toast.success("Configuración actualizada"); };
  const reset = () => { setSettings(settingsService.resetSettings()); toast.info("Preferencias restablecidas"); };
  return <div className="w-full max-w-3xl mx-auto space-y-6">
    <button onClick={onBack} className="min-h-11 px-3 rounded-xl border border-white/10 text-sm text-slate-300 flex items-center gap-2 focus-visible:outline-2 focus-visible:outline-indigo-400"><ArrowLeft className="w-4 h-4" />Regresar</button>
    <div className="pb-4 border-b border-white/[0.08]"><h2 className="text-xl font-bold text-white flex gap-2 items-center"><Settings className="w-5 h-5 text-indigo-400" />Configuración y preferencias</h2><p className="text-xs text-slate-400">Estas preferencias se guardan únicamente en este navegador.</p></div>
    <div className="p-5 rounded-2xl bg-[#101218] border border-white/[0.08] space-y-3">
      <Toggle label="Reducir animaciones" help="Reduce transiciones y respeta también la preferencia del sistema." checked={settings.reducedMotion} onChange={(v) => change("reducedMotion", v)} />
      <Toggle label="Guardar historial local" help="Si se desactiva, no se registran tareas nuevas; el historial existente no se elimina." checked={settings.saveHistory} onChange={(v) => change("saveHistory", v)} />
      <Toggle label="Confirmar antes de limpiar el historial" help="Evita borrar por accidente todas las entradas locales." checked={settings.confirmBeforeClearHistory} onChange={(v) => change("confirmBeforeClearHistory", v)} />
    </div>
    <button onClick={reset} className="min-h-11 px-4 rounded-xl border border-white/10 text-sm text-slate-200 flex items-center gap-2"><RotateCcw className="w-4 h-4" />Restablecer preferencias</button>
  </div>;
};

const Toggle = ({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (value: boolean) => void }) => <label className="min-h-16 flex items-center justify-between gap-4 p-3 rounded-xl bg-[#08090D] border border-white/[0.05] cursor-pointer"><span><span className="block text-xs font-semibold text-white">{label}</span><span className="block text-[11px] text-slate-400">{help}</span></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="w-5 h-5 accent-indigo-500" /></label>;
