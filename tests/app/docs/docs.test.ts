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
});
