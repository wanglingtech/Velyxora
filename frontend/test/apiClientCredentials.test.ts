import test from "node:test";
import assert from "node:assert";
import { ApiClient } from "../src/services/apiClient";

test("authenticated API calls centrally include credentials and CSRF", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const isLogin = String(input).endsWith("/auth/login");
    return new Response(JSON.stringify({
      success: true,
      data: isLogin ? { user: { id: "user" }, csrf: "csrf-token" } : { user: { id: "user" } },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;

  try {
    const client = new ApiClient();
    await client.auth.login("user@example.com", "password");
    await client.auth.me();
    await client.auth.account();
    await client.auth.adminDashboard();
    await client.auth.logout();

    assert.strictEqual(calls.length, 5);
    for (const call of calls) assert.strictEqual(call.init?.credentials, "include", call.url);
    assert.strictEqual(new Headers(calls.at(-1)?.init?.headers).get("X-CSRF-Token"), "csrf-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('CSRF_INVALID recupera token y reintenta una sola vez; FORBIDDEN no se reintenta', async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  let suggestionAttempts = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input); calls.push(url);
    if (url.endsWith('/auth/login')) return new Response(JSON.stringify({ success: true, data: { user: { id: 'u' }, csrf: 'old' } }), { status: 200 });
    if (url.endsWith('/auth/me')) return new Response(JSON.stringify({ success: true, data: { user: { id: 'u' }, csrf: 'fresh' } }), { status: 200 });
    if (url.endsWith('/feedback/suggestions')) {
      suggestionAttempts += 1;
      if (suggestionAttempts === 1) return new Response(JSON.stringify({ success: false, error: { code: 'CSRF_INVALID', message: 'Token CSRF inválido.' } }), { status: 403 });
      return new Response(JSON.stringify({ success: true, data: { id: 'ok' } }), { status: 201 });
    }
    return new Response(JSON.stringify({ success: false, error: { code: 'FORBIDDEN', message: 'Acceso denegado.' } }), { status: 403 });
  }) as typeof fetch;
  try {
    const client = new ApiClient();
    await client.auth.login('u@example.com', 'password');
    await client.feedback.createSuggestion({ category: 'MEJORA', title: 'Título', description: 'Descripción válida' });
    assert.equal(suggestionAttempts, 2);
    assert.equal(calls.filter((url) => url.endsWith('/auth/me')).length, 1);
    const before = calls.length;
    await assert.rejects(client.auth.moderateUser('x', 'BAN', 'reason'), (error: any) => error.code === 'FORBIDDEN');
    assert.equal(calls.length, before + 1);
  } finally { globalThis.fetch = originalFetch; }
});
