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
