import test from "node:test";
import assert from "node:assert/strict";
import { isPublicShareUrl, shareResult } from "../src/services/shareService";
import { downloadService } from "../src/services/downloadService";

const fakeFile = { name: "resultado.webp", type: "image/webp", size: 12 } as File;

test("comparte un archivo solo cuando navigator.canShare lo acepta", async () => {
  let shared: ShareData | undefined;
  let downloaded = false;
  const outcome = await shareResult({
    kind: "file",
    getFile: async () => fakeFile,
    download: () => { downloaded = true; },
  }, {
    canShare: (data) => data.files?.[0] === fakeFile,
    share: async (data) => { shared = data; },
  });
  assert.deepEqual(outcome, { status: "shared" });
  assert.equal(shared?.files?.[0], fakeFile);
  assert.equal(downloaded, false);
});

test("archivo no compatible conserva la descarga como fallback", async () => {
  let downloaded = 0;
  let shareCalls = 0;
  const outcome = await shareResult({
    kind: "file",
    getFile: async () => fakeFile,
    download: () => { downloaded += 1; },
  }, {
    canShare: () => false,
    share: async () => { shareCalls += 1; },
  });
  assert.deepEqual(outcome, { status: "fallback", action: "download" });
  assert.equal(downloaded, 1);
  assert.equal(shareCalls, 0);
});

test("archivo usa descarga si navigator.share existe pero canShare no", async () => {
  let downloaded = false;
  let shareCalls = 0;
  const outcome = await shareResult({
    kind: "file",
    getFile: async () => fakeFile,
    download: () => { downloaded = true; },
  }, {
    share: async () => { shareCalls += 1; },
  });
  assert.deepEqual(outcome, { status: "fallback", action: "download" });
  assert.equal(downloaded, true);
  assert.equal(shareCalls, 0);
});

test("sin Web Share API aplica fallbacks de archivo y texto", async () => {
  let fileResolved = false;
  let downloaded = false;
  let copied = "";
  const fileOutcome = await shareResult({
    kind: "file",
    getFile: async () => { fileResolved = true; return fakeFile; },
    download: () => { downloaded = true; },
  }, {});
  const textOutcome = await shareResult({
    kind: "text",
    text: "resultado",
    copy: (value) => { copied = value; },
  }, {});
  assert.deepEqual(fileOutcome, { status: "fallback", action: "download" });
  assert.deepEqual(textOutcome, { status: "fallback", action: "copy-text" });
  assert.equal(fileResolved, false, "no debe descargar el archivo en memoria si el fallback es directo");
  assert.equal(downloaded, true);
  assert.equal(copied, "resultado");
});

test("comparte texto y URL pública con el payload correcto", async () => {
  const payloads: ShareData[] = [];
  await shareResult({ kind: "text", title: "Texto", text: "hola", copy: () => {} }, {
    share: async (data) => { payloads.push(data); },
  });
  await shareResult({ kind: "url", title: "Enlace", url: "https://velyxora.com/r/demo", copy: () => {} }, {
    share: async (data) => { payloads.push(data); },
  });
  assert.deepEqual(payloads, [
    { title: "Texto", text: "hola" },
    { title: "Enlace", text: undefined, url: "https://velyxora.com/r/demo" },
  ]);
});

test("cancelar el share sheet no se convierte en error", async () => {
  const outcome = await shareResult({ kind: "text", text: "hola", copy: () => {} }, {
    share: async () => { throw new DOMException("cancelado", "AbortError"); },
  });
  assert.deepEqual(outcome, { status: "cancelled" });
});

test("un fallo real de navigator.share se propaga", async () => {
  await assert.rejects(
    shareResult({ kind: "text", text: "hola", copy: () => {} }, {
      share: async () => { throw new TypeError("share failed"); },
    }),
    /share failed/,
  );
});

test("URL sin Web Share API se copia solo cuando es pública", async () => {
  let copied = "";
  const outcome = await shareResult({
    kind: "url",
    url: "https://velyxora.com/s/demo",
    copy: (value) => { copied = value; },
  }, {});
  assert.deepEqual(outcome, { status: "fallback", action: "copy-url" });
  assert.equal(copied, "https://velyxora.com/s/demo");
});

test("un fallback de portapapeles no disponible se propaga como fallo real", async () => {
  await assert.rejects(
    shareResult({
      kind: "text",
      text: "resultado",
      copy: async () => { throw new Error("CLIPBOARD_UNAVAILABLE"); },
    }, {}),
    /CLIPBOARD_UNAVAILABLE/,
  );
});

test("no expone URLs privadas, locales, blob, file ni credenciales", async () => {
  const rejected = [
    "blob:https://velyxora.com/id",
    "file:///tmp/result.pdf",
    "http://localhost:3000/api/download/id",
    "http://127.0.0.1/result",
    "http://192.168.1.8/result",
    "http://[::]/result",
    "http://[::1]/result",
    "http://[fe80::1]/result",
    "http://[fc00::1]/result",
    "http://[fd00::1]/result",
    "http://[::ffff:127.0.0.1]/result",
    "http://[::ffff:10.0.0.1]/result",
    "http://[::ffff:172.16.0.1]/result",
    "http://[::ffff:192.168.1.1]/result",
    "http://[::ffff:169.254.1.1]/result",
    "http://[::ffff:100.64.0.1]/result",
    "http://[::ffff:7f00:1]/result",
    "http://[::c0a8:101]/result",
    "http://service.internal/result",
    "https://user:secret@example.com/result",
    "/api/download/private-id",
  ];
  for (const url of rejected) assert.equal(isPublicShareUrl(url), false, url);
  assert.equal(isPublicShareUrl("https://velyxora.com/s/publico"), true);
  assert.equal(isPublicShareUrl("https://example.com/publico"), true);
  assert.equal(isPublicShareUrl("https://[2001:4860:4860::8888]/x"), true);

  let copied = false;
  await assert.rejects(
    shareResult({ kind: "url", url: "blob:https://velyxora.com/private", copy: () => { copied = true; } }, {}),
    /SHARE_PRIVATE_URL/,
  );
  assert.equal(copied, false);
});

test("el servicio de descarga conserva el click y libera el Object URL", async () => {
  const originalDocument = globalThis.document;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let clicked = false;
  let appended = false;
  let removed = false;
  let revoked = "";
  const anchor = { href: "", download: "", style: { display: "" }, click: () => { clicked = true; }, remove: () => { removed = true; } };
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement: () => anchor,
    body: { appendChild: () => { appended = true; } },
  } });
  URL.createObjectURL = () => "blob:test-download";
  URL.revokeObjectURL = (url) => { revoked = url; };
  try {
    downloadService.downloadBlob(new Blob(["ok"], { type: "text/plain" }), "resultado.txt");
    assert.equal(anchor.download, "resultado.txt");
    assert.equal(clicked, true);
    assert.equal(appended, true);
    assert.equal(removed, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(revoked, "blob:test-download");
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    Object.defineProperty(globalThis, "document", { configurable: true, value: originalDocument });
  }
});
