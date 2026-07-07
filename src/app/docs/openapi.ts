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
  },
};
