#!/usr/bin/env node
// Developer port manager for the VELYXORA dev server.
//
// Ports involved:
//   3000   unified server (Express API + Vite middleware)
//   24678  Vite HMR websocket (opened by the same process)
//   5173   standalone Vite dev server (only used by the two-terminal flow)
//
// Modes:
//   node .scripts/dev-ports.mjs           report who owns the ports (default)
//   node .scripts/dev-ports.mjs --stop    terminate only processes that belong
//                                         to this repository
//   node .scripts/dev-ports.mjs --guard   exit 1 if a port is taken; used as
//                                         `predev` to replace the cryptic
//                                         EADDRINUSE stack trace
//
// Ownership is decided from the listener's command line (it must reference
// this repository). Anything else is reported and never killed.

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const PORTS = [3000, 24678, 5173];
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IS_WINDOWS = process.platform === "win32";
const MODE = process.argv[2] ?? "--status";

/** Normalize a Windows/POSIX path so ownership comparisons are case- and slash-insensitive. */
const normalize = (value) => value.replace(/\\/g, "/").toLowerCase();

const REPO_MARKER = normalize(REPO_ROOT);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function belongsToRepo(commandLine) {
  if (!commandLine) return false;
  const normalized = normalize(commandLine);
  return normalized.includes(REPO_MARKER);
}

function parseOwnerLines(output) {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("|");
      return {
        port: Number(parts[0]),
        pid: Number(parts[1]),
        name: parts[2] || "?",
        commandLine: parts.slice(3).join("|"),
      };
    })
    .filter((item) => PORTS.includes(item.port) && Number.isFinite(item.pid));
}

// `Get-NetTCPConnection -LocalPort <p>` throws a CimJobException when nothing
// matches, so query every listener once and filter in memory instead.
const POWERSHELL_LISTENERS = `
$ErrorActionPreference = 'SilentlyContinue'
$wanted = 3000, 24678, 5173
$conns = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue
foreach ($c in $conns) {
  if ($wanted -notcontains $c.LocalPort) { continue }
  $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$($c.OwningProcess)" -ErrorAction SilentlyContinue
  '{0}|{1}|{2}|{3}' -f $c.LocalPort, $c.OwningProcess, $proc.Name, $proc.CommandLine
}
exit 0`;

/** Fallback for hosts where the NetTCPIP module is unavailable. */
function listListenersNetstat() {
  const output = execFileSync("netstat", ["-ano"], { encoding: "utf8", windowsHide: true });
  const owned = new Map();
  for (const line of output.split(/\r?\n/)) {
    const columns = line.trim().split(/\s+/);
    if (columns.length < 5) continue;
    const local = columns[1];
    if (!/:(\d+)$/.test(local)) continue;
    const port = Number(local.slice(local.lastIndexOf(":") + 1));
    if (!PORTS.includes(port)) continue;
    if (!/^(listening|escuchando)/i.test(columns[3])) continue;
    const pid = Number(columns[columns.length - 1]);
    if (!Number.isFinite(pid)) continue;
    owned.set(`${port}:${pid}`, { port, pid });
  }
  if (owned.size === 0) return [];
  const uniquePids = [...new Set([...owned.values()].map((item) => item.pid))];
  const filter = uniquePids.map((pid) => `ProcessId=${pid}`).join(" or ");
  const script = `
$ErrorActionPreference = 'SilentlyContinue'
foreach ($proc in Get-CimInstance Win32_Process -Filter "${filter}") {
  '{0}|{1}|{2}' -f $proc.ProcessId, $proc.Name, $proc.CommandLine
}
exit 0`;
  const details = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
    encoding: "utf8",
    windowsHide: true,
  });
  const byPid = new Map();
  for (const raw of details.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("|");
    byPid.set(Number(parts[0]), { name: parts[1] || "?", commandLine: parts.slice(2).join("|") });
  }
  return [...owned.values()].map(({ port, pid }) => ({
    port,
    pid,
    name: byPid.get(pid)?.name ?? "?",
    commandLine: byPid.get(pid)?.commandLine ?? "",
  }));
}

function listListenersWindows() {
  try {
    const output = execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", POWERSHELL_LISTENERS], {
      encoding: "utf8",
      windowsHide: true,
    });
    return parseOwnerLines(output);
  } catch {
    return listListenersNetstat();
  }
}

function listListenersPosix() {
  const listeners = [];
  for (const port of PORTS) {
    let pids = [];
    try {
      pids = execFileSync("lsof", ["-ti", `tcp:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" })
        .split(/\s+/)
        .filter(Boolean)
        .map(Number);
    } catch {
      continue;
    }
    for (const pid of pids) {
      let commandLine = "";
      try {
        commandLine = execFileSync("ps", ["-o", "command=", "-p", String(pid)], { encoding: "utf8" }).trim();
      } catch {
        // The process disappeared between lsof and ps.
      }
      listeners.push({ port, pid, name: "node", commandLine });
    }
  }
  return listeners;
}

const listListeners = () => (IS_WINDOWS ? listListenersWindows() : listListenersPosix());

function killTree(pid) {
  if (IS_WINDOWS) {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
    } catch {
      // Already gone.
    }
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
  } catch {
    // Already gone.
  }
}

async function main() {
  const listeners = listListeners();

  if (MODE === "--guard") {
    if (listeners.length === 0) return 0;
    const ours = listeners.filter((item) => belongsToRepo(item.commandLine));
    console.error("");
    for (const item of listeners) {
      const owner = belongsToRepo(item.commandLine) ? "servidor de VELYXORA" : `${item.name} (ajeno al proyecto)`;
      console.error(`  puerto ${item.port} ocupado por PID ${item.pid} — ${owner}`);
    }
    console.error("");
    if (ours.length > 0) {
      console.error("Ya hay una instancia de desarrollo corriendo.");
      console.error("Deténla con:  npm run dev:stop    (o Ctrl+C en su terminal)");
    } else {
      console.error("El puerto lo ocupa otro programa; libéralo manualmente antes de continuar.");
    }
    console.error("");
    return 1;
  }

  if (MODE === "--stop") {
    const ours = listeners.filter((item) => belongsToRepo(item.commandLine));
    const foreign = listeners.filter((item) => !belongsToRepo(item.commandLine));

    if (ours.length === 0) {
      console.log("No hay ningún servidor de VELYXORA escuchando en 3000/24678/5173.");
    } else {
      const pids = [...new Set(ours.map((item) => item.pid))];
      for (const pid of pids) killTree(pid);
      await sleep(1200);
    }

    for (const item of foreign) {
      console.warn(`Aviso: el puerto ${item.port} sigue ocupado por PID ${item.pid} (${item.name}), que no pertenece a este proyecto.`);
    }

    const remaining = listListeners().filter((item) => belongsToRepo(item.commandLine));
    if (remaining.length === 0) {
      console.log("Puertos libres: 3000, 24678, 5173.");
      return 0;
    }
    console.error("No se pudieron liberar: " + remaining.map((item) => `${item.port} (PID ${item.pid})`).join(", "));
    return 1;
  }

  if (listeners.length === 0) {
    console.log("Puertos libres: 3000, 24678, 5173.");
    return 0;
  }
  for (const item of listeners) {
    const owner = belongsToRepo(item.commandLine) ? "VELYXORA" : "otro proceso";
    console.log(`puerto ${item.port}: PID ${item.pid} (${item.name}, ${owner})`);
  }
  return 0;
}

process.exit(await main());
