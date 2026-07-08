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
    "/api/v1/shipment-categories": {
      get: {
        summary: "List all shipment categories (admin only)",
        operationId: "listShipmentCategories",
        tags: ["Shipment Categories"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          "200": { description: "Paginated list of shipment categories" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin access required" },
        },
      },
      post: {
        summary: "Create a shipment category (admin only)",
        operationId: "createShipmentCategory",
        tags: ["Shipment Categories"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "slug", "minPrice"],
                properties: {
                  name: { type: "string", example: "Electronics" },
                  slug: { type: "string", example: "electronics" },
                  maxWeight: { type: "number", example: 50 },
                  minPrice: { type: "number", example: 10 },
                  maxPrice: { type: "number", example: 200 },
                  maxQuantity: { type: "integer", example: 100 },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Shipment category created" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin access required" },
        },
      },
    },
    "/api/v1/shipment-categories/{id}": {
      get: {
        summary: "Get a shipment category by ID (admin only)",
        operationId: "getShipmentCategory",
        tags: ["Shipment Categories"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Shipment category details" },
          "404": { description: "Shipment category not found" },
        },
      },
      patch: {
        summary: "Update a shipment category (admin only)",
        operationId: "updateShipmentCategory",
        tags: ["Shipment Categories"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  slug: { type: "string" },
                  maxWeight: { type: "number" },
                  minPrice: { type: "number" },
                  maxPrice: { type: "number" },
                  maxQuantity: { type: "integer" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Shipment category updated" },
          "404": { description: "Shipment category not found" },
        },
      },
      delete: {
        summary: "Delete a shipment category (admin only)",
        operationId: "deleteShipmentCategory",
        tags: ["Shipment Categories"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Shipment category deleted" },
          "404": { description: "Shipment category not found" },
        },
      },
    },
    "/api/v1/shipments": {
      get: {
        summary: "List authenticated user's shipments",
        operationId: "listShipments",
        tags: ["Shipments"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "page",
            in: "query",
            schema: { type: "integer", default: 1 },
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", default: 10 },
          },
        ],
        responses: {
          "200": { description: "Paginated list of user's shipments" },
          "401": { description: "Not authenticated" },
          "403": { description: "Email verification required" },
        },
      },
      post: {
        summary: "Create a shipment (verified user only)",
        operationId: "createShipment",
        tags: ["Shipments"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "itemName",
                  "weight",
                  "quantity",
                  "description",
                  "instructions",
                  "fromCountry",
                  "toCountry",
                  "pricePerKg",
                  "receiverName",
                  "receiverPhone",
                  "receiverAddress",
                  "categoryId",
                ],
                properties: {
                  itemName: { type: "string", example: "Laptop" },
                  weight: { type: "number", example: 5 },
                  quantity: { type: "integer", example: 2 },
                  description: { type: "string" },
                  itemPhotos: { type: "array", items: { type: "string" } },
                  instructions: { type: "string" },
                  fromCountry: { type: "string", example: "US" },
                  toCountry: { type: "string", example: "BD" },
                  pricePerKg: { type: "number", example: 100 },
                  receiverName: { type: "string" },
                  receiverPhone: { type: "string" },
                  receiverAddress: { type: "string" },
                  categoryId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Shipment created" },
          "400": {
            description: "Constraint violation (weight/quantity/price)",
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Email verification required" },
          "404": { description: "Shipment category not found" },
        },
      },
    },
    "/api/v1/shipments/{id}": {
      get: {
        summary: "Get a shipment by ID",
        operationId: "getShipment",
        tags: ["Shipments"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Shipment details" },
          "404": { description: "Shipment not found" },
        },
      },
      patch: {
        summary: "Update a shipment",
        operationId: "updateShipment",
        tags: ["Shipments"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  itemName: { type: "string" },
                  weight: { type: "number" },
                  quantity: { type: "integer" },
                  description: { type: "string" },
                  itemPhotos: { type: "array", items: { type: "string" } },
                  instructions: { type: "string" },
                  fromCountry: { type: "string" },
                  toCountry: { type: "string" },
                  pricePerKg: { type: "number" },
                  receiverName: { type: "string" },
                  receiverPhone: { type: "string" },
                  receiverAddress: { type: "string" },
                  categoryId: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Shipment updated" },
          "404": { description: "Shipment not found" },
        },
      },
      delete: {
        summary: "Delete a shipment",
        operationId: "deleteShipment",
        tags: ["Shipments"],
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": { description: "Shipment deleted" },
          "404": { description: "Shipment not found" },
        },
      },
    },
  },
};
