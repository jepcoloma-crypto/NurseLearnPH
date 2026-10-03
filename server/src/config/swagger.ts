import swaggerJsdoc from "swagger-jsdoc";
import { config } from "./index.js";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "NurseLearn PH API",
      version: "0.1.0",
      description:
        "Nursing Competency, Clinical Reasoning & Learning Platform API. " +
        "Provides endpoints for courses, assessments, clinical simulations, " +
        "NLE prep, AI tutoring, research, and analytics.",
      contact: {
        name: "NurseLearn PH Team",
      },
    },
    servers: [
      {
        url: `http://localhost:${config.PORT}`,
        description: "Local development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT access token",
        },
      },
      schemas: {
        SuccessResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: { description: "Response data" },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            error: {
              type: "object",
              properties: {
                message: { type: "string" },
                code: { type: "string" },
              },
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email", example: "student@nurselearn.local" },
            password: { type: "string", example: "newpass123" },
          },
        },
        LoginResponse: {
          type: "object",
          properties: {
            accessToken: { type: "string" },
            refreshToken: { type: "string" },
            user: {
              type: "object",
              properties: {
                id: { type: "string", format: "uuid" },
                email: { type: "string" },
                role: { type: "string", enum: ["STUDENT", "INSTRUCTOR", "PROGRAM_COORDINATOR", "CLINICAL_INSTRUCTOR", "ADMIN"] },
              },
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["email", "password", "firstName", "lastName"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 8 },
            firstName: { type: "string" },
            lastName: { type: "string" },
            middleName: { type: "string" },
          },
        },
        Course: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            code: { type: "string", example: "NUR101" },
            name: { type: "string" },
            description: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Question: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            stem: { type: "string" },
            type: { type: "string", enum: ["MC", "TF", "SAQ", "NCLEX"] },
            difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
            courseId: { type: "string", format: "uuid" },
          },
        },
        Assessment: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            type: { type: "string", enum: ["QUIZ", "MIDTERM", "FINAL", "NCLEX"] },
            courseId: { type: "string", format: "uuid" },
          },
        },
        Topic: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string" },
            courseId: { type: "string", format: "uuid" },
          },
        },
        Lesson: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            topicId: { type: "string", format: "uuid" },
          },
        },
        ClinicalCase: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            difficulty: { type: "string" },
          },
        },
        SimulationSession: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            scenarioId: { type: "string", format: "uuid" },
            status: { type: "string", enum: ["IN_PROGRESS", "COMPLETED"] },
            score: { type: "number" },
          },
        },
        NLEQuestion: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            questionText: { type: "string" },
            questionType: { type: "string" },
            difficulty: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  optionText: { type: "string" },
                  isCorrect: { type: "boolean" },
                },
              },
            },
          },
        },
        Pagination: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            total: { type: "number" },
            totalPages: { type: "number" },
          },
        },
        User: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            email: { type: "string" },
            firstName: { type: "string" },
            lastName: { type: "string" },
            role: { type: "string" },
            isActive: { type: "boolean" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ["./src/modules/*/routes.md", "./src/modules/*/*.routes.ts"],
};

export const swaggerSpec = swaggerJsdoc(options);
