import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prisma from "./prisma";
import { admin as adminPlugin, emailOTP, openAPI } from "better-auth/plugins";
import config from "../../config/index";
import { ac, admin, user } from "../../config/permissions";
import { sendVerificationOTP } from "./email";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    // requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: config.google.client_id,
      clientSecret: config.google.client_secret,
    },
  },
  trustedOrigins: [config.frontend_url],
  plugins: [
    emailOTP({
      sendVerificationOTP,
      sendVerificationOnSignUp: true,
      overrideDefaultEmailVerification: true,
    }),
    adminPlugin({
      ac,
      roles: { admin, user },
      defaultRole: "user",
    }),
    openAPI(),
  ],
});
