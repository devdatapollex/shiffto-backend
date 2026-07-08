import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../../src/app";

describe("api docs", () => {
  it("serves an OpenAPI spec at /api/docs/openapi.json", async () => {
    const response = await request(app)
      .get("/api/docs/openapi.json")
      .expect(200);

    expect(response.body).toMatchObject({
      openapi: "3.1.0",
      info: expect.any(Object),
      paths: expect.any(Object),
    });
  });

  it("documents frontend auth alignment endpoints", async () => {
    const response = await request(app)
      .get("/api/docs/openapi.json")
      .expect(200);

    expect(response.body.paths).toEqual(
      expect.objectContaining({
        "/api/auth/sign-up/email": expect.any(Object),
        "/api/auth/sign-in/email": expect.any(Object),
        "/api/auth/sign-in/social": expect.any(Object),
        "/api/auth/get-session": expect.any(Object),
        "/api/auth/admin/has-permission": expect.any(Object),
      }),
    );
  });
});
