import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "./helpers.js";

describe("Health & Info Endpoints", () => {
  it("GET /api/health should return ok", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.version).toBe("0.1.0");
    expect(res.body.timestamp).toBeDefined();
  });

  it("GET /api/info should return app info", async () => {
    const res = await request(app).get("/api/info");

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("NurseLearn PH");
    expect(res.body.phase).toBe(22);
  });

  it("GET /nonexistent should return 404", async () => {
    const res = await request(app).get("/api/nonexistent");

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
