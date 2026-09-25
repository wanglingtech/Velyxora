import React, { useEffect, useMemo, useRef, useState } from "react";
import { apiClient } from "../../services/apiClient";
import {
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import { CurrentUser, useAuth } from "../../auth/AuthContext";
import { ACCOUNT_SERVICE_SUMMARY } from "../../config/freeService";
import {
  SERVICE_OPERATIONAL_STATES,
  SERVICE_STATE_DOTS,
  SERVICE_STATE_LABELS,
  SERVICE_STATE_TONES,
  isServiceOperationalState,
  type ServiceOperationalState,
} from "../../config/serviceStatus";

const shell =
  "mx-auto max-w-3xl rounded-2xl border border-white/10 bg-[#101218] p-5 sm:p-8";
const input =
  "w-full rounded-xl border border-white/10 bg-[#08090D] px-4 py-3 text-sm outline-none focus:border-indigo-500";

export function AuthView({
  onAuthenticated,
  onBack,
  initialMode = "login",
}: {
  onAuthenticated: (user: CurrentUser) => void;
  onBack: () => void;
  initialMode?: "login" | "register";
}) {
  const { login, register: createAccount } = useAuth();
  const [register, setRegister] = useState(initialMode === "register");
  const [email, setEmail] = useState(
    () => localStorage.getItem("velyxora_remembered_email") || "",
  );
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [remember, setRemember] = useState(
    Boolean(localStorage.getItem("velyxora_remembered_email")),
  );
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setError("");
    if (register && password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    try {
      const user = register
        ? await createAccount({ email, password, displayName })
        : await login({ email, password });
      if (remember)
        localStorage.setItem("velyxora_remembered_email", email.trim());
      else localStorage.removeItem("velyxora_remembered_email");
      onAuthenticated(user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const field = (icon: React.ReactNode, child: React.ReactNode) => (
    <div className="auth-field">
      {icon}
      {child}
    </div>
  );
  return (
    <section className="auth-shell">
      <div className="auth-visual" aria-hidden="true">
        <div className="auth-brand-mark">
          <Zap />
        </div>
        <p>VELYXORA PLATFORM</p>
        <h2>
          Todo tu flujo digital,
          <br />
          <span>en un solo lugar.</span>
        </h2>
        <div className="auth-feature">
          <ShieldCheck />
          <span>
            <strong>Sesiones seguras</strong>
            <small>Protección por cookie HttpOnly y CSRF</small>
          </span>
        </div>
        <div className="auth-feature">
          <Sparkles />
          <span>
            <strong>Herramientas inteligentes</strong>
            <small>Una experiencia rápida y consistente</small>
          </span>
        </div>
      </div>
      <div className="auth-panel">
        <button onClick={onBack} className="auth-back">
          ← Regresar
        </button>
        <div className="auth-mobile-brand">
          <Zap /> VELYXORA
        </div>
        <p className="auth-eyebrow">
          {register ? "NUEVA CUENTA" : "ACCESO SEGURO"}
        </p>
        <h1>{register ? "Crea tu espacio" : "Bienvenido nuevamente"}</h1>
        <p className="auth-copy">
          {register
            ? "Empieza a potenciar tu flujo de trabajo."
            : "Ingresa para continuar donde lo dejaste."}
        </p>
        <form onSubmit={submit} className="auth-form">
          {register && (
            <label>
              Nombre
              {field(
                <UserRound />,
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="name"
                  placeholder="Tu nombre"
                />,
              )}
            </label>
          )}
          <label>
            Correo electrónico
            {field(
              <Mail />,
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nombre@correo.com"
              />,
            )}
          </label>
          <label>
            Contraseña
            <div className="auth-field">
              <LockKeyhole />
              <input
                type={showPassword ? "text" : "password"}
                required
                minLength={10}
                maxLength={200}
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
              />
              <button
                type="button"
                aria-label={
                  showPassword ? "Ocultar contraseña" : "Mostrar contraseña"
                }
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
          </label>
          {register && (
            <>
              <label>
                Confirmar contraseña
                {field(
                  <LockKeyhole />,
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={10}
                    maxLength={200}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="Repite tu contraseña"
                  />,
                )}
              </label>
              <p
                className={
                  password.length >= 10 ? "password-ok" : "password-hint"
                }
              >
                ✓ Entre 10 y 200 caracteres
              </p>
            </>
          )}
          {!register && (
            <label className="remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>Recordar mi correo</span>
            </label>
          )}
          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}
          <button disabled={busy} className="auth-submit">
            {busy
              ? register
                ? "Creando cuenta…"
                : "Iniciando sesión…"
              : register
                ? "Crear cuenta"
                : "Iniciar sesión"}
          </button>
        </form>
        <p className="auth-switch">
          {register ? "¿Ya tienes una cuenta?" : "¿No tienes una cuenta?"}{" "}
          <button
            onClick={() => {
              setRegister(!register);
              setError("");
              setPassword("");
              setConfirm("");
            }}
          >
            {register ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </p>
      </div>
    </section>
  );
}

export function AccountView({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<any>();
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const load = async () => {
    const account = await apiClient.auth.account();
    setData(account);
    setError("");
  };
  const refresh = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  return (
    <section className={`${shell} max-w-5xl`}>
      <button onClick={onBack} className="mb-5 min-h-11 text-sm text-slate-400">
        ← Regresar
      </button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mi cuenta</h1>
        <button
          disabled={refreshing}
          onClick={refresh}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-indigo-200 disabled:opacity-60"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Actualizando…" : "Recargar"}
        </button>
      </div>
      {!data && !error && (
        <p className="mt-6 text-sm text-slate-400">Cargando tu cuenta…</p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-500/20 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}
      {data && (
        <div className="mt-6 space-y-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Estado" value="Activa" />
            {ACCOUNT_SERVICE_SUMMARY.map((item) => (
              <Metric key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
          <p className="break-all text-sm text-slate-400">{data.email}</p>
          {data.capabilities?.localAdminMode && <p className="rounded-xl border border-indigo-400/20 bg-indigo-400/5 p-3 text-sm text-indigo-200">Modo administrador local: no se aplican límites de uso adicionales; las protecciones técnicas y de formato permanecen activas.</p>}
          <AccountList
            title="Jobs recientes"
            empty="No hay jobs recientes."
            items={data.jobs}
            render={(job: any) => (
              <>
                <span>
                  {job.toolId} · {new Date(job.createdAt).toLocaleString()}
                </span>
                <span>{job.status}</span>
              </>
            )}
          />
          <AccountList
            title="Historial sincronizado"
            empty="Tu historial sincronizado está vacío."
            items={data.history}
            render={(item: any) => (
              <>
                <span>
                  {item.toolId} · {new Date(item.createdAt).toLocaleString()}
                </span>
                <span>
                  {item.status} · {item.processingType}
                  {item.inputSize ? ` · ${formatBytes(item.inputSize)}` : ""}
                </span>
              </>
            )}
          />
          <AccountList
            title="Mis reclamos"
            empty="No has presentado reclamos."
            items={data.complaints}
            render={(item: any) => (
              <>
                <span>
                  {item.trackingCode} · {item.subject}
                </span>
                <span>
                  {item.status}
                  {item.adminResponse ? ` · ${item.adminResponse}` : ""}
                </span>
              </>
            )}
          />
          <AccountList
            title="Mis sugerencias"
            empty="No has enviado sugerencias."
            items={data.suggestions}
            render={(item: any) => (
              <>
                <span>
                  {item.reaction} {item.title}
                </span>
                <span>
                  {item.status}
                  {item.adminResponse ? ` · ${item.adminResponse}` : ""}
                </span>
              </>
            )}
          />
        </div>
      )}
    </section>
  );
}
export function AdminView({ onBack }: { onBack: () => void }) {
  const [dashboard, setDashboard] = useState<any>();
  const [users, setUsers] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [shortLinkReports, setShortLinkReports] = useState<any[]>([]);
  const [serviceStatus, setServiceStatus] = useState<any>();
  const [draftState, setDraftState] = useState<ServiceOperationalState>("OPERATIONAL");
  const [draftMessage, setDraftMessage] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  const load = () =>
    Promise.all([
      apiClient.auth.adminDashboard(),
      apiClient.auth.adminUsers(),
      apiClient.auth.adminComplaints(),
      apiClient.auth.adminSuggestions(),
      apiClient.auth.adminShortLinkReports(),
      apiClient.auth.adminServiceStatus(),
    ]).then(([d, u, c, s, reports, status]) => {
      setDashboard(d);
      setUsers(u);
      setComplaints(c);
      setSuggestions(s);
      setShortLinkReports(reports);
      setServiceStatus(status);
      setDraftState(isServiceOperationalState(status?.state) ? status.state : "OPERATIONAL");
      setDraftMessage(status?.message ?? "");
      setError("");
    });
  const refresh = async () => {
    if (refreshLock.current) return;
    refreshLock.current = true;
    setRefreshing(true);
    try {
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      refreshLock.current = false;
      setRefreshing(false);
    }
  };
  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);
  const saveServiceStatus = async () => {
    if (statusSaving) return;
    setStatusSaving(true);
    setStatusFeedback(null);
    try {
      const saved = await apiClient.auth.updateServiceStatus(draftState, draftMessage);
      setServiceStatus((previous: any) => ({
        ...(previous || {}),
        state: saved.state,
        message: saved.message,
        persisted: true,
        updatedAt: saved.updatedAt,
      }));
      setDraftState(isServiceOperationalState(saved.state) ? saved.state : draftState);
      setDraftMessage(saved.message ?? "");
      setStatusFeedback({ kind: "success", text: "Estado del servicio actualizado." });
    } catch (e: any) {
      setStatusFeedback({ kind: "error", text: e?.message || "No se pudo guardar el estado del servicio." });
    } finally {
      setStatusSaving(false);
    }
  };
  const moderate = async (user: any, action: string) => {
    if (
      !window.confirm(
        `Confirma ${action} para ${user.email}. Esta acción será auditada.`,
      )
    )
      return;
    const reason = window.prompt("Motivo obligatorio (mínimo 5 caracteres)");
    if (!reason) return;
    setBusy(user.id);
    try {
      await apiClient.auth.moderateUser(user.id, action, reason);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const respondComplaint = async (item: any) => {
    const response = window.prompt(
      "Respuesta para el reclamante",
      item.adminResponse || "",
    );
    if (!response || busy) return;
    setBusy(item.id);
    try {
      await apiClient.auth.updateComplaint(item.id, "RESPONDED", response);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const respondSuggestion = async (item: any) => {
    const response = window.prompt(
      "Respuesta para el usuario",
      item.adminResponse || "",
    );
    if (!response || busy) return;
    const reaction =
      window.prompt("Reacción opcional: 👍 ❤️ 🎉 💡 👀", "👍") || "";
    setBusy(item.id);
    try {
      await apiClient.auth.updateSuggestion(
        item.id,
        "REVIEWING",
        response,
        reaction,
      );
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  };
  const moderateLink = async (item: any, action: 'DISABLE' | 'ENABLE') => {
    const reason = window.prompt(action === 'DISABLE' ? 'Motivo para deshabilitar el enlace' : 'Motivo para reactivar el enlace');
    if (!reason || busy) return;
    setBusy(item.id);
    try { await apiClient.auth.moderateShortLink(item.shortLink.slug, action, reason); await apiClient.auth.reviewShortLinkReport(item.id, 'REVIEWED'); await load(); }
    catch (e: any) { setError(e.message); } finally { setBusy(''); }
  };
  const filteredUsers = useMemo(
    () =>
      users.filter(
        (user) =>
          (statusFilter === "ALL" || user.status === statusFilter) &&
          user.email.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [users, query, statusFilter],
  );
  const effectiveServiceState: ServiceOperationalState = isServiceOperationalState(serviceStatus?.state)
    ? serviceStatus.state
    : "UNAVAILABLE";
  const statusDirty =
    Boolean(serviceStatus) &&
    (draftState !== serviceStatus.state ||
      draftMessage.trim() !== (serviceStatus.message ?? ""));
  return (
    <section className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-white/10 bg-[#0d1018] shadow-2xl">
      <header className="border-b border-white/10 bg-gradient-to-r from-indigo-500/10 to-cyan-500/5 p-5 sm:p-8">
        <button onClick={onBack} className="min-h-11 text-sm text-slate-400">
          ← Volver a mi cuenta
        </button>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-[.24em] text-indigo-400">
              CONSOLA VELYXORA
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
              Panel administrativo
            </h1>
            <p className="mt-1 text-sm text-slate-400">
              Supervisión segura de usuarios, uso y comunidad.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              disabled={refreshing}
              onClick={refresh}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm text-indigo-200 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Actualizando…" : "Recargar"}
            </button>
          </div>
        </div>
      </header>
      <div className="p-5 sm:p-8">
        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-500/20 p-3 text-red-300"
          >
            {error}
          </p>
        )}
        {dashboard && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Metric label="Usuarios totales" value={dashboard.users} />
            <Metric label="Usuarios activos" value={dashboard.activeUsers} />
            <Metric label="Procesamientos" value={dashboard.jobs} />
            <Metric label="Reclamos pendientes" value={dashboard.pendingComplaints} />
          </div>
        )}
        {serviceStatus && (
          <section className="mt-9" aria-labelledby="admin-service-status-title">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 id="admin-service-status-title" className="font-semibold">
                  Estado del servicio
                </h2>
                <p className="text-xs text-slate-500">
                  Estado de producto que se muestra públicamente en la cabecera.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-500">Actual</span>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${SERVICE_STATE_TONES[effectiveServiceState]}`}
                >
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${SERVICE_STATE_DOTS[effectiveServiceState]}`} />
                  {SERVICE_STATE_LABELS[effectiveServiceState]}
                </span>
                {!serviceStatus.persisted && (
                  <span className="text-[11px] text-slate-500">automático (sin configuración manual)</span>
                )}
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-white/5 bg-black/20 p-4">
              <fieldset disabled={statusSaving}>
                <legend className="text-xs font-medium text-slate-400">Nuevo estado</legend>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {SERVICE_OPERATIONAL_STATES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={draftState === value}
                      onClick={() => setDraftState(value)}
                      className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors ${draftState === value ? "border-indigo-500 bg-indigo-600/20 text-white" : "border-white/10 text-slate-300 hover:border-indigo-500/40"}`}
                    >
                      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${SERVICE_STATE_DOTS[value]}`} />
                      {SERVICE_STATE_LABELS[value]}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="admin-service-status-message" className="mt-4 block text-xs font-medium text-slate-400">
                Mensaje público (opcional)
              </label>
              <textarea
                id="admin-service-status-message"
                className={`${input} mt-2 min-h-20 resize-y`}
                maxLength={200}
                value={draftMessage}
                disabled={statusSaving}
                onChange={(e) => setDraftMessage(e.target.value)}
                placeholder="Estamos realizando mantenimiento temporal."
              />
              <p className="mt-1 text-[11px] text-slate-500">
                {draftMessage.trim().length}/200 · texto plano
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={statusSaving || !statusDirty}
                  onClick={saveServiceStatus}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-medium disabled:opacity-50"
                >
                  {statusSaving && <RefreshCw className="h-4 w-4 animate-spin" />}
                  {statusSaving ? "Guardando…" : "Guardar estado"}
                </button>
                {statusFeedback?.kind === "success" && (
                  <span role="status" className="text-xs text-emerald-300">{statusFeedback.text}</span>
                )}
                {statusFeedback?.kind === "error" && (
                  <span role="alert" className="text-xs text-rose-300">{statusFeedback.text}</span>
                )}
              </div>
            </div>
          </section>
        )}
        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">Gestión de usuarios</h2>
            <p className="text-xs text-slate-500">
              {filteredUsers.length} resultados
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              aria-label="Buscar usuarios"
              className={`${input} sm:w-64`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por correo…"
            />
            <select
              aria-label="Filtrar por estado"
              className={`${input} sm:w-40`}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="ALL">Todos</option>
              <option value="ACTIVE">Activos</option>
              <option value="SUSPENDED">Suspendidos</option>
            </select>
          </div>
        </div>
        <div className="mt-4 hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-slate-500">
                <th className="p-3">Usuario</th>
                <th>Estado</th>
                <th>Registro</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-white/5 transition hover:bg-white/[.025]"
                >
                  <td className="p-3 font-medium break-all">{user.email}</td>
                  <td>
                    <StatusBadge value={user.status} />
                  </td>
                  <td className="text-slate-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 grid gap-3 md:hidden">
          {filteredUsers.map((user) => (
            <article
              key={user.id}
              className="rounded-2xl border border-white/8 bg-black/20 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="break-all text-sm font-semibold">{user.email}</p>
                <StatusBadge value={user.status} />
              </div>
              <div className="mt-3 text-xs">
                <span className="text-slate-500">
                  Registro
                  <strong className="mt-1 block text-slate-200">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </strong>
                </span>
              </div>
            </article>
          ))}
        </div>
        <h2 className="mt-10 font-semibold">Moderación de usuarios</h2>
        <div className="mt-3 grid gap-3">
          {filteredUsers.map((user) => (
            <article
              key={`moderate-${user.id}`}
              className="rounded-xl border border-white/5 bg-black/20 p-4"
            >
              <p className="break-all text-sm">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {user.status !== "ACTIVE" && (
                  <button
                    onClick={() => moderate(user, "REACTIVATE")}
                    className="min-h-10 rounded-lg bg-emerald-700 px-3 text-xs"
                  >
                    Reactivar
                  </button>
                )}
                <button
                  onClick={() => moderate(user, "SUSPEND")}
                  className="min-h-10 rounded-lg border border-amber-500/30 px-3 text-xs text-amber-300"
                >
                  Suspender
                </button>
                <button
                  onClick={() => moderate(user, "BAN")}
                  className="min-h-10 rounded-lg border border-rose-500/30 px-3 text-xs text-rose-300"
                >
                  Ban permanente
                </button>
                <button
                  onClick={() => moderate(user, "ANONYMIZE")}
                  className="min-h-10 rounded-lg border border-white/15 px-3 text-xs text-slate-300"
                >
                  Anonimizar
                </button>
              </div>
            </article>
          ))}
        </div>
        <h2 className="mt-10 font-semibold">
          Reclamos{" "}
          <span className="text-indigo-400">
            {dashboard?.pendingComplaints ?? 0}
          </span>
        </h2>
        <h2 className="mt-10 font-semibold">Reportes de enlaces cortos</h2>
        <div className="mt-3 grid gap-3">
          {shortLinkReports.filter((item) => item.status === 'PENDING').map((item) => <article key={item.id} className="rounded-xl border border-white/5 bg-black/20 p-4 text-sm">
            <p><strong>{item.category}</strong> · /s/{item.shortLink.slug}</p>
            {item.detail && <p className="mt-1 text-slate-400">{item.detail}</p>}
            <div className="mt-3 flex gap-2"><button disabled={Boolean(busy)} onClick={() => moderateLink(item, 'DISABLE')} className="min-h-10 rounded-lg border border-rose-500/30 px-3 text-xs text-rose-300">Deshabilitar</button><button disabled={Boolean(busy)} onClick={async () => { setBusy(item.id); try { await apiClient.auth.reviewShortLinkReport(item.id, 'DISMISSED'); await load(); } catch (e: any) { setError(e.message); } finally { setBusy(''); } }} className="min-h-10 rounded-lg border border-white/15 px-3 text-xs">Descartar reporte</button></div>
          </article>)}
          {!shortLinkReports.some((item) => item.status === 'PENDING') && <p className="rounded-xl bg-black/20 p-4 text-sm text-slate-400">No hay reportes pendientes.</p>}
        </div>
        <div className="mt-3 grid gap-3">
          {complaints.map((item) => (
            <article
              key={item.id}
              className="rounded-xl bg-black/20 p-4 text-sm"
            >
              <div className="flex justify-between gap-3">
                <strong>
                  {item.type}: {item.subject}
                </strong>
                <StatusBadge value={item.status} />
              </div>
              <p className="mt-2 line-clamp-3 text-slate-400">{item.detail}</p>
              <button
                onClick={() => respondComplaint(item)}
                className="mt-3 min-h-10 text-indigo-300"
              >
                Abrir y responder
              </button>
            </article>
          ))}
        </div>
        <h2 className="mt-10 font-semibold">
          Sugerencias nuevas{" "}
          <span className="text-indigo-400">
            {dashboard?.newSuggestions ?? 0}
          </span>
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {suggestions.map((item) => (
            <article
              key={item.id}
              className="rounded-xl bg-black/20 p-4 text-sm"
            >
              <strong>
                {item.reaction} {item.title}
              </strong>
              <p className="mt-2 line-clamp-3 text-slate-400">
                {item.description}
              </p>
              <button
                onClick={() => respondSuggestion(item)}
                className="mt-3 min-h-10 text-indigo-300"
              >
                Revisar y responder
              </button>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
function StatusBadge({ value }: { value: string }) {
  const positive = ["ACTIVE", "COMPLETED", "RESPONDED"].includes(
    value,
  );
  const danger = ["BANNED", "ANONYMIZED"].includes(value);
  const labels: Record<string, string> = {
    ACTIVE: "ACTIVO",
    SUSPENDED: "SUSPENDIDO",
    BANNED: "BANEADO",
    ANONYMIZED: "ANONIMIZADO",
    RECEIVED: "RECIBIDO",
    IN_REVIEW: "EN REVISIÓN",
    RESPONDED: "RESPONDIDO",
    CLOSED: "CERRADO",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${positive ? "bg-emerald-500/10 text-emerald-300" : danger ? "bg-rose-500/10 text-rose-300" : "bg-amber-500/10 text-amber-300"}`}
    >
      {labels[value] || value}
    </span>
  );
}
function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
function AccountList({
  title,
  empty,
  items,
  render,
}: {
  title: string;
  empty: string;
  items: any[];
  render: (item: any) => React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {items?.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((item, index) => (
            <li
              key={item.id || index}
              className="flex flex-col justify-between gap-1 rounded-lg bg-black/20 p-3 sm:flex-row"
            >
              {render(item)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl bg-black/20 p-4 text-sm text-slate-400">
          {empty}
        </p>
      )}
    </div>
  );
}
function formatBytes(value: string | number) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes)) return "—";
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
