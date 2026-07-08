import config from "../../config/index";

export const openapiDoc = {
  openapi: "3.1.0",
  info: {
    title: "Shiffto API",
    version: "1.0.0",
    description: "Shiffto backend API documentation",
  },
  servers: [
    {
      url: `http://localhost:${config.port}`,
      description: "Local development server",
    },
  ],
  paths: {
    "/api/health": {
      get: {
        summary: "Health check",
        operationId: "healthCheck",
        responses: {
          "200": {
            description: "Service is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string", format: "date-time" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/auth/sign-up/email": {
      post: {
        summary: "Sign up with email and password",
        operationId: "authSignUpEmail",
        tags: ["Auth"],
        parameters: [
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string", example: config.frontend_url },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string", example: "Test User" },
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Better Auth sign-up response" },
        },
      },
    },
    "/api/auth/email-otp/send-verification-otp": {
      post: {
        summary: "Send a verification OTP to the user's email",
        operationId: "authEmailOtpSendVerification",
        tags: ["Auth"],
        parameters: [
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string", example: config.frontend_url },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "type"],
                properties: {
                  email: { type: "string", format: "email" },
                  type: {
                    type: "string",
                    enum: ["email-verification", "sign-in", "forget-password"],
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "OTP sent successfully" },
        },
      },
    },
    "/api/auth/email-otp/verify-email": {
      post: {
        summary: "Verify email address with OTP",
        operationId: "authEmailOtpVerifyEmail",
        tags: ["Auth"],
        parameters: [
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string", example: config.frontend_url },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp"],
                properties: {
                  email: { type: "string", format: "email" },
                  otp: { type: "string", description: "6-digit OTP code" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Email verified successfully" },
        },
      },
    },
    "/api/auth/sign-in/email": {
      post: {
        summary: "Sign in with email and password",
        operationId: "authSignInEmail",
        tags: ["Auth"],
        parameters: [
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string", example: config.frontend_url },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Better Auth sign-in response" },
        },
      },
    },
    "/api/auth/sign-in/social": {
      post: {
        summary: "Start Google OAuth sign-in",
        operationId: "authSignInSocial",
        tags: ["Auth"],
        parameters: [
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string", example: config.frontend_url },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["provider"],
                properties: {
                  provider: { type: "string", enum: ["google"] },
                  callbackURL: {
                    type: "string",
                    example: `${config.frontend_url}/dashboard`,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Better Auth social sign-in response" },
        },
      },
    },
    "/api/auth/get-session": {
      get: {
        summary: "Get the current Better Auth session",
        operationId: "authGetSession",
        tags: ["Auth"],
        parameters: [
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string", example: config.frontend_url },
          },
        ],
        responses: {
          "200": { description: "Current session or null" },
        },
      },
    },
    "/api/auth/admin/has-permission": {
      post: {
        summary: "Check permissions through Better Auth Admin plugin",
        operationId: "authAdminHasPermission",
        tags: ["Auth", "Admin"],
        parameters: [
          {
            name: "Origin",
            in: "header",
            required: true,
            schema: { type: "string", example: config.frontend_url },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  permissions: {
                    type: "object",
                    additionalProperties: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Permission check result" },
        },
      },
    },
  },
};
