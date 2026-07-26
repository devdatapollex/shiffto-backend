import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import {
  admin as adminPlugin,
  bearer,
  emailOTP,
  openAPI,
} from "better-auth/plugins";
import config from "../../config/index";
import { ac, admin, user } from "../../config/permissions";
import { sendVerificationOTP } from "./email";

import { APIError, createAuthMiddleware } from "better-auth/api";

const rolesConfig = { admin, user };

export const auth = betterAuth({
  advanced: {
    disableOriginCheck: true, // set false for production
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const email = (ctx.body as { email?: string })?.email
          ?.toLowerCase()
          .trim();
        if (email) {
          const existingUser = await prisma.user.findFirst({
            where: {
              email: { equals: email, mode: "insensitive" },
            },
          });
          if (existingUser) {
            throw new APIError("BAD_REQUEST", {
              message: "User with this email already exists",
            });
          }
        }
      }
    }),
  },
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
  },
  socialProviders: {
    google: {
      clientId: config.google.client_id,
      clientSecret: config.google.client_secret,
    },
  },
  trustedOrigins: [config.frontend_url, config.mobile_app_url],
  plugins: [
    bearer(),
    emailOTP({
      sendVerificationOTP,
      sendVerificationOnSignUp: false,
      overrideDefaultEmailVerification: true,
    }),
    adminPlugin({
      ac,
      roles: rolesConfig,
      defaultRole: "user",
    }),
    openAPI(),
  ],
});

// Extract the updated session type (which contains the updated user type)
export type Session = typeof auth.$Infer.Session;
export type Role = keyof typeof rolesConfig;
export type User = Omit<Session["user"], "role"> & { role: Role };
