import { describe, expect, it } from "vitest";
import { ac, admin, statement, user } from "../../src/config/permissions";

describe("auth permissions", () => {
  it("defines the shared domain permission statements", () => {
    expect(statement.shipment).toEqual(["create", "view", "cancel", "browse"]);
    expect(statement.trip).toEqual(["create", "view", "update-status"]);
    expect(statement.settlement).toEqual(["release", "view"]);
    expect(statement.withdrawal).toEqual(["process", "view"]);
    expect(statement.user).toContain("set-role");
    expect(statement.session).toContain("revoke");
    expect(ac.statements).toBe(statement);
  });

  it("allows regular users to use shipment and trip features only", () => {
    expect(
      user.authorize({
        shipment: ["create", "view", "cancel", "browse"],
        trip: ["create", "view", "update-status"],
      }),
    ).toEqual({ success: true });

    expect(user.authorize({ settlement: ["release"] }).success).toBe(false);
    expect(user.authorize({ withdrawal: ["process"] }).success).toBe(false);
    expect(user.authorize({ user: ["set-role"] }).success).toBe(false);
  });

  it("allows admins to use domain and admin-plugin permissions", () => {
    expect(
      admin.authorize({
        shipment: ["create", "view", "cancel", "browse"],
        trip: ["create", "view", "update-status"],
        settlement: ["release", "view"],
        withdrawal: ["process", "view"],
        user: ["set-role", "ban", "get"],
        session: ["list", "revoke", "delete"],
      }),
    ).toEqual({ success: true });
  });
});
