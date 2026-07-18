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
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Better Auth session token",
      },
    },
  },
  paths: {
    // ── Health ────────────────────────────────────────────────────────
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

    // ── Auth (Better Auth) ────────────────────────────────────────────
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
    "/api/auth/email-otp/request-password-reset": {
      post: {
        summary: "Request a password reset OTP",
        operationId: "authEmailOtpRequestPasswordReset",
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
                required: ["email"],
                properties: {
                  email: { type: "string", format: "email" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password reset OTP sent successfully" },
        },
      },
    },
    "/api/auth/email-otp/reset-password": {
      post: {
        summary: "Reset password with OTP and new password",
        operationId: "authEmailOtpResetPassword",
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
                required: ["email", "otp", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  otp: { type: "string", description: "6-digit OTP code" },
                  password: {
                    type: "string",
                    minLength: 8,
                    description: "New password",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password reset successfully" },
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

    // ── Uploads ───────────────────────────────────────────────────────
    "/api/v1/uploads/photos": {
      post: {
        summary: "Upload shipment item photos",
        operationId: "uploadPhotos",
        tags: ["Uploads"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "multipart/form-data": {
              schema: {
                type: "object",
                required: ["photos"],
                properties: {
                  photos: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                    maxItems: 10,
                    description:
                      "Images to upload (jpg, jpeg, png, webp, max 5MB each)",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Photos uploaded, returns array of { key, url }",
          },
          "400": {
            description: "Invalid file type, size, or no files provided",
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Email verification required" },
        },
      },
    },

    // ── Shipment Categories ───────────────────────────────────────────
    "/api/v1/shipment-categories": {
      get: {
        summary: "List all shipment categories",
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
        summary: "Get a shipment category by ID",
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

    // ── Shipments ─────────────────────────────────────────────────────
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
                  "otp",
                ],
                properties: {
                  itemName: { type: "string", example: "Laptop" },
                  weight: { type: "number", example: 5 },
                  quantity: { type: "integer", example: 2 },
                  description: { type: "string" },
                  itemPhotos: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 10,
                    description:
                      "Upload photo URLs (from POST /api/v1/uploads/photos), max 10",
                  },
                  instructions: { type: "string" },
                  fromCountry: { type: "string", example: "US" },
                  toCountry: { type: "string", example: "BD" },
                  pricePerKg: { type: "number", example: 100 },
                  receiverName: { type: "string" },
                  receiverPhone: { type: "string" },
                  receiverAddress: { type: "string" },
                  categoryId: { type: "string" },
                  otp: {
                    type: "string",
                    minLength: 6,
                    maxLength: 6,
                    description: "6-digit OTP from email verification",
                  },
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
    "/api/v1/shipments/send-otp": {
      post: {
        summary: "Send a verification OTP to the authenticated user's email",
        operationId: "sendShipmentOtp",
        tags: ["Shipments"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "OTP sent to email successfully" },
          "401": { description: "Not authenticated" },
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
                  itemPhotos: {
                    type: "array",
                    items: { type: "string" },
                    maxItems: 10,
                    description:
                      "Upload photo URLs (from POST /api/v1/uploads/photos), max 10",
                  },
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
    "/api/v1/shipments/{id}/steps": {
      get: {
        summary: "Get shipment step progression history",
        operationId: "getShipmentSteps",
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
          "200": { description: "Shipment steps fetched successfully" },
          "401": { description: "Not authenticated" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/offers": {
      get: {
        summary: "Get offers for a shipment",
        operationId: "getOffersForShipment",
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
          "200": { description: "Offers fetched successfully" },
          "401": { description: "Not authenticated" },
          "403": { description: "Only shipment owner can view offers" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/details": {
      get: {
        summary: "Get detailed shipment information with step tracking",
        operationId: "getShipmentDetails",
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
          "200": { description: "Shipment details fetched successfully" },
          "401": { description: "Not authenticated" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/confirm-payment": {
      post: {
        summary: "Confirm payment for a shipment",
        operationId: "confirmPayment",
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
          "200": { description: "Payment confirmed, shipment activated" },
          "400": { description: "Shipment not in AWAITING_MATCH status" },
          "401": { description: "Not authenticated" },
          "403": { description: "Access denied" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/send-delivery-otp": {
      post: {
        summary: "Send delivery OTP to shipment owner",
        operationId: "sendDeliveryOtp",
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
          "200": { description: "OTP sent to shipment owner's email" },
          "401": { description: "Not authenticated" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/steps/confirm-pickup": {
      post: {
        summary: "Confirm pickup (step 2 to 3)",
        operationId: "confirmPickup",
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
                required: ["photoUrl"],
                properties: {
                  photoUrl: {
                    type: "string",
                    description: "Photo proof of pickup",
                  },
                  notes: { type: "string", description: "Optional notes" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Pickup confirmed" },
          "400": { description: "Invalid step or missing requirements" },
          "401": { description: "Not authenticated" },
          "403": { description: "Access denied" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/steps/confirm-checkin": {
      post: {
        summary: "Confirm check-in (step 3 to 4)",
        operationId: "confirmCheckin",
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
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes: { type: "string", description: "Optional notes" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Check-in confirmed" },
          "400": { description: "Invalid step" },
          "401": { description: "Not authenticated" },
          "403": { description: "Access denied" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/steps/confirm-transit": {
      post: {
        summary: "Confirm in-transit (step 4 to 5)",
        operationId: "confirmTransit",
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
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes: { type: "string", description: "Optional notes" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Transit confirmed" },
          "400": { description: "Invalid step" },
          "401": { description: "Not authenticated" },
          "403": { description: "Access denied" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/steps/confirm-arrival": {
      post: {
        summary: "Confirm arrival at destination (step 5 to 6)",
        operationId: "confirmArrival",
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
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes: { type: "string", description: "Optional notes" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Arrival confirmed" },
          "400": { description: "Invalid step" },
          "401": { description: "Not authenticated" },
          "403": { description: "Access denied" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/steps/confirm-out-for-delivery": {
      post: {
        summary: "Confirm out for delivery (step 6 to 7)",
        operationId: "confirmOutForDelivery",
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
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  notes: { type: "string", description: "Optional notes" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Out for delivery confirmed" },
          "400": { description: "Invalid step" },
          "401": { description: "Not authenticated" },
          "403": { description: "Access denied" },
          "404": { description: "Shipment not found" },
        },
      },
    },
    "/api/v1/shipments/{id}/steps/confirm-delivery": {
      post: {
        summary: "Confirm delivery (final step, requires OTP + photo)",
        operationId: "confirmDelivery",
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
                required: ["otp", "photoUrl"],
                properties: {
                  otp: {
                    type: "string",
                    description: "6-digit OTP from shipment owner",
                  },
                  photoUrl: {
                    type: "string",
                    description: "Photo proof of delivery",
                  },
                  notes: { type: "string", description: "Optional notes" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Delivery confirmed, shipment completed" },
          "400": { description: "Invalid OTP or step" },
          "401": { description: "Not authenticated" },
          "403": { description: "Access denied" },
          "404": { description: "Shipment not found" },
        },
      },
    },

    // ── Trips ─────────────────────────────────────────────────────────
    "/api/v1/trips": {
      get: {
        summary: "List authenticated user's trips",
        operationId: "listTrips",
        tags: ["Trips"],
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
          "200": { description: "Paginated list of user's trips" },
          "401": { description: "Not authenticated" },
          "403": { description: "Email verification required" },
        },
      },
      post: {
        summary: "Create a trip (verified user only)",
        operationId: "createTrip",
        tags: ["Trips"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "flightNumber",
                  "fromCountry",
                  "toCountry",
                  "flightDate",
                  "flightTime",
                  "cabinBagCapacity",
                  "checkInBagCapacity",
                  "ticketPhoto",
                ],
                properties: {
                  flightNumber: {
                    type: "string",
                    example: "BA123",
                  },
                  fromCountry: { type: "string", example: "US" },
                  toCountry: { type: "string", example: "BD" },
                  flightDate: {
                    type: "string",
                    example: "2026-07-20",
                  },
                  flightTime: { type: "string", example: "14:30" },
                  airportArrivalTime: {
                    type: "string",
                    example: "10:30",
                  },
                  cabinBagCapacity: { type: "number", example: 2 },
                  checkInBagCapacity: {
                    type: "number",
                    example: 1,
                  },
                  ticketPhoto: {
                    type: "string",
                    description: "Photo URL of flight ticket",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Trip created successfully" },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
          "403": { description: "Email verification required" },
        },
      },
    },
    "/api/v1/trips/available-shipments": {
      get: {
        summary: "Get available shipments matching trip route",
        operationId: "getAvailableShipments",
        tags: ["Trips"],
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
          "200": {
            description: "Paginated list of available shipments",
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Email verification required" },
        },
      },
    },
    "/api/v1/trips/{id}": {
      get: {
        summary: "Get a trip by ID",
        operationId: "getTrip",
        tags: ["Trips"],
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
          "200": { description: "Trip details" },
          "401": { description: "Not authenticated" },
          "404": { description: "Trip not found" },
        },
      },
      patch: {
        summary: "Update a trip",
        operationId: "updateTrip",
        tags: ["Trips"],
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
                  flightNumber: { type: "string" },
                  fromCountry: { type: "string" },
                  toCountry: { type: "string" },
                  flightDate: { type: "string" },
                  flightTime: { type: "string" },
                  airportArrivalTime: { type: "string" },
                  cabinBagCapacity: { type: "number" },
                  checkInBagCapacity: { type: "number" },
                  ticketPhoto: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Trip updated successfully" },
          "401": { description: "Not authenticated" },
          "404": { description: "Trip not found" },
        },
      },
    },
    "/api/v1/trips/{id}/cancel": {
      post: {
        summary: "Cancel a trip",
        operationId: "cancelTrip",
        tags: ["Trips"],
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
          "200": { description: "Trip cancelled successfully" },
          "401": { description: "Not authenticated" },
          "404": { description: "Trip not found" },
        },
      },
    },
    "/api/v1/trips/{id}/verify": {
      post: {
        summary: "Verify a trip (admin only)",
        operationId: "verifyTrip",
        tags: ["Trips", "Admin"],
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
                required: ["approved"],
                properties: {
                  approved: {
                    type: "boolean",
                    description: "Approve or reject the trip",
                  },
                  rejectionReason: {
                    type: "string",
                    description: "Required if rejected",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Trip verification updated successfully",
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin access required" },
          "404": { description: "Trip not found" },
        },
      },
    },
    "/api/v1/trips/{id}/accept-shipment": {
      post: {
        summary: "Accept a shipment onto a trip",
        operationId: "acceptShipment",
        tags: ["Trips"],
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
                  shipmentId: {
                    type: "string",
                    description: "Shipment ID to accept",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Shipment accepted for trip successfully",
          },
          "401": { description: "Not authenticated" },
          "404": { description: "Trip not found" },
        },
      },
    },
    "/api/v1/trips/{id}/complete": {
      post: {
        summary: "Complete a trip",
        operationId: "completeTrip",
        tags: ["Trips"],
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
          "200": { description: "Trip completed successfully" },
          "401": { description: "Not authenticated" },
          "404": { description: "Trip not found" },
        },
      },
    },

    // ── Profile ───────────────────────────────────────────────────────
    "/api/v1/profile": {
      get: {
        summary: "Get the authenticated user's profile",
        operationId: "getProfile",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Profile fetched successfully" },
          "401": { description: "Not authenticated" },
        },
      },
      patch: {
        summary: "Update the authenticated user's profile",
        operationId: "updateProfile",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  phone: { type: "string", nullable: true },
                  image: {
                    type: "string",
                    format: "uri",
                    nullable: true,
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Profile updated successfully" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/profile/change-password": {
      post: {
        summary: "Change the authenticated user's password",
        operationId: "changePassword",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "currentPassword",
                  "newPassword",
                  "confirmPassword",
                ],
                properties: {
                  currentPassword: { type: "string" },
                  newPassword: { type: "string", minLength: 8 },
                  confirmPassword: { type: "string", minLength: 8 },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Password changed successfully" },
          "400": {
            description:
              "Passwords do not match or invalid current password",
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/profile/kyc": {
      post: {
        summary: "Submit KYC verification documents",
        operationId: "submitKyc",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: [
                  "documentType",
                  "documentNumber",
                  "nationality",
                  "phoneNumber",
                  "frontPhotoUrl",
                  "frontPhotoKey",
                  "backPhotoUrl",
                  "backPhotoKey",
                ],
                properties: {
                  documentType: {
                    type: "string",
                    enum: ["PASSPORT", "DRIVING_LICENSE", "NID"],
                  },
                  documentNumber: { type: "string" },
                  nationality: { type: "string" },
                  phoneNumber: { type: "string" },
                  frontPhotoUrl: { type: "string", format: "uri" },
                  frontPhotoKey: { type: "string" },
                  backPhotoUrl: { type: "string", format: "uri" },
                  backPhotoKey: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "KYC verification submitted successfully",
          },
          "400": { description: "Validation error" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/profile/deactivate": {
      post: {
        summary: "Deactivate the authenticated user's account",
        operationId: "deactivateAccount",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Account deactivated successfully",
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/profile/delete": {
      post: {
        summary: "Permanently delete the authenticated user's account",
        operationId: "deleteAccount",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["password"],
                properties: {
                  password: {
                    type: "string",
                    description: "Current password for confirmation",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "Account deleted permanently" },
          "400": { description: "Invalid password" },
          "401": { description: "Not authenticated" },
        },
      },
    },

    // ── Admin ─────────────────────────────────────────────────────────
    "/api/v1/admin/kyc": {
      get: {
        summary: "Get all KYC submissions (admin only)",
        operationId: "getKycSubmissions",
        tags: ["Admin"],
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
          "200": {
            description: "Paginated list of KYC submissions",
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin access required" },
        },
      },
    },
    "/api/v1/admin/kyc/{id}": {
      patch: {
        summary:
          "Review a KYC submission (approve/reject, admin only)",
        operationId: "reviewKyc",
        tags: ["Admin"],
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
                required: ["status"],
                properties: {
                  status: {
                    type: "string",
                    enum: ["APPROVED", "REJECTED"],
                  },
                  rejectionReason: {
                    type: "string",
                    nullable: true,
                    description: "Required if rejected",
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "KYC submission reviewed successfully",
          },
          "400": {
            description: "Rejection reason required when rejecting",
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin access required" },
          "404": { description: "KYC submission not found" },
        },
      },
    },
    "/api/v1/admin/users/{id}/reactivate": {
      patch: {
        summary:
          "Reactivate a deactivated user account (admin only)",
        operationId: "reactivateUser",
        tags: ["Admin"],
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
          "200": { description: "User reactivated successfully" },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin access required" },
          "404": { description: "User not found" },
        },
      },
    },

    // ── Notifications ─────────────────────────────────────────────────
    "/api/v1/notifications": {
      get: {
        summary: "Get authenticated user's notifications",
        operationId: "getNotifications",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Notifications fetched successfully",
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/notifications/read-all": {
      patch: {
        summary: "Mark all notifications as read",
        operationId: "markAllNotificationsRead",
        tags: ["Notifications"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "All notifications marked as read",
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/notifications/{id}/read": {
      patch: {
        summary: "Mark a single notification as read",
        operationId: "markNotificationRead",
        tags: ["Notifications"],
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
          "200": { description: "Notification marked as read" },
          "401": { description: "Not authenticated" },
          "404": { description: "Notification not found" },
        },
      },
    },

    // ── Step Definitions ──────────────────────────────────────────────
    "/api/v1/shipments-steps": {
      get: {
        summary: "List all step definitions",
        operationId: "getStepDefinitions",
        tags: ["Step Definitions"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": {
            description: "Step definitions fetched successfully",
          },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/shipments-steps/{id}": {
      patch: {
        summary: "Update a step definition (admin only)",
        operationId: "updateStepDefinition",
        tags: ["Step Definitions"],
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
                  label: { type: "string" },
                  description: { type: "string", nullable: true },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Step definition updated successfully",
          },
          "401": { description: "Not authenticated" },
          "403": { description: "Admin access required" },
          "404": { description: "Step definition not found" },
        },
      },
    },

    // ── Offers ────────────────────────────────────────────────────────
    "/api/v1/offers": {
      post: {
        summary: "Create an offer for a shipment",
        operationId: "createOffer",
        tags: ["Offers"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["shipmentId", "tripId", "offeredPrice", "bagType"],
                properties: {
                  shipmentId: { type: "string", description: "Shipment ID" },
                  tripId: { type: "string", description: "Trip ID" },
                  offeredPrice: {
                    type: "number",
                    description: "Offered price (must be positive)",
                  },
                  bagType: {
                    type: "string",
                    enum: ["cabin", "checkIn"],
                    description: "Bag type for the shipment",
                  },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Offer created successfully" },
          "400": { description: "Validation error or business rule violation" },
          "401": { description: "Not authenticated" },
          "404": { description: "Shipment or trip not found" },
        },
      },
    },
    "/api/v1/offers/sent": {
      get: {
        summary: "Get offers sent by the authenticated traveller",
        operationId: "getSentOffers",
        tags: ["Offers"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Sent offers fetched successfully" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/offers/received": {
      get: {
        summary: "Get pending offers received for the user's shipments",
        operationId: "getReceivedOffers",
        tags: ["Offers"],
        security: [{ bearerAuth: [] }],
        responses: {
          "200": { description: "Received offers fetched successfully" },
          "401": { description: "Not authenticated" },
        },
      },
    },
    "/api/v1/offers/{id}/accept": {
      post: {
        summary: "Accept a pending offer (shipment owner only)",
        operationId: "acceptOffer",
        tags: ["Offers"],
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
          "200": { description: "Offer accepted successfully" },
          "400": { description: "Offer is not pending" },
          "401": { description: "Not authenticated" },
          "403": { description: "Only shipment owner can accept" },
          "404": { description: "Offer not found" },
        },
      },
    },
    "/api/v1/offers/{id}": {
      delete: {
        summary: "Reject a pending offer (shipment owner only)",
        operationId: "rejectOffer",
        tags: ["Offers"],
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
          "200": { description: "Offer rejected successfully" },
          "400": { description: "Offer is not pending" },
          "401": { description: "Not authenticated" },
          "403": { description: "Only shipment owner can reject" },
          "404": { description: "Offer not found" },
        },
      },
    },
  },
};
