import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "./app";

describe("health endpoint", () => {
  it("returns an ok status and timestamp", async () => {
    const response = await request(app).get("/api/health").expect(200);

    expect(response.body).toEqual({
      status: "ok",
      timestamp: expect.any(String),
    });
    expect(Number.isNaN(Date.parse(response.body.timestamp))).toBe(false);
  });
});
