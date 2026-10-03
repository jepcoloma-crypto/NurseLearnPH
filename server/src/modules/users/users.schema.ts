import { z } from "zod";

const roleEnum = z.enum([
  "ADMIN",
  "PROGRAM_COORDINATOR",
  "INSTRUCTOR",
  "CLINICAL_INSTRUCTOR",
  "STUDENT",
]);

// Phone-style contact number, e.g. "+63 917 123 4567". Empty string clears it.
const contactNumberSchema = z
  .string()
  .max(30, "Contact number must be at most 30 characters")
  .regex(/^[+()0-9\s-]*$/, "Invalid contact number")
  .nullish();

export const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  email: z.string().email("Invalid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  middleName: z.string().max(100).optional(),
  contactNumber: contactNumberSchema,
  role: roleEnum.default("STUDENT"),
});

export const updateUserSchema = z.object({
  username: z.string().min(3).max(50).optional(),
  email: z.string().email("Invalid email address").optional(),
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  middleName: z.string().max(100).optional(),
  contactNumber: contactNumberSchema,
  role: roleEnum.optional(),
  isActive: z.boolean().optional(),
});

export const updateUserPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(500).default(15),
  role: roleEnum.optional(),
  search: z.string().optional(),
  isActive: z.coerce.boolean().optional(),
  // pending=true → verified signups still awaiting admin activation
  pending: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
