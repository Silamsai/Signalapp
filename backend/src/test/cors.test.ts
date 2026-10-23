import { describe, expect, it } from "vitest";

// The browser blocks a cross-origin PUT/PATCH unless the CORS preflight allows it
describe("CORS preflight", () => {
  it("allows every method the frontend uses", async () => {
    process.env.DATABASE_URL ||= "postgres://user:pass@localhost:5432/unused";
    process.env.AUTH_SECRET ||= "test-secret-test-secret";
    process.env.FRONTEND_ORIGIN ||= "http://localhost:3000";
    const { buildApp } = await import("../app.js");
    const app = await buildApp({ logger: false });
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/v1/workspaces/x/settings/offer",
        headers: {
          origin: process.env.FRONTEND_ORIGIN!,
          "access-control-request-method": method,
          "access-control-request-headers": "content-type",
        },
      });
      expect(res.statusCode).toBe(204);
      expect(String(res.headers["access-control-allow-methods"])).toContain(method);
    }
    await app.close();
  });

  it("allows another localhost port in development but never a foreign site", async () => {
    const { buildApp } = await import("../app.js");
    const app = await buildApp({ logger: false });
    const preflight = (origin: string) =>
      app.inject({
        method: "OPTIONS",
        url: "/v1/auth/login",
        headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
      });
    expect((await preflight("http://localhost:3001")).headers["access-control-allow-origin"]).toBe("http://localhost:3001");
    expect((await preflight("https://evil.example")).headers["access-control-allow-origin"]).toBeUndefined();
    await app.close();
  });
});
