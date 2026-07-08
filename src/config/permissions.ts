import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements } from "better-auth/plugins/admin/access";

export const statement = {
  ...defaultStatements,
  shipment: ["create", "view", "cancel", "browse"],
  trip: ["create", "view", "update-status"],
  settlement: ["release", "view"],
  withdrawal: ["process", "view"],
} as const;

export const ac = createAccessControl(statement);

export const user = ac.newRole({
  shipment: ["create", "view", "cancel", "browse"],
  trip: ["create", "view", "update-status"],
});

export const admin = ac.newRole({
  ...adminAc.statements,
  shipment: ["create", "view", "cancel", "browse"],
  trip: ["create", "view", "update-status"],
  settlement: ["release", "view"],
  withdrawal: ["process", "view"],
});
