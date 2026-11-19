import { z } from "zod";
import { crmLocaleSchema, ERROR_CODES, idSchema, refSchema, text } from "./common";

export const USER_ROLES = ["ADMIN", "MANAGER", "EMPLOYEE"] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

/** Parts of the CRM that access is granted to. Milestone 3 adds tickets and tasks. */
export const PERMISSION_AREAS = ["CUSTOMERS", "SALES"] as const;
export const permissionAreaSchema = z.enum(PERMISSION_AREAS);
export type PermissionArea = z.infer<typeof permissionAreaSchema>;

/** VIEW: read. EDIT: also create and update. MANAGE: also delete. Ordered from least to most. */
export const ACCESS_LEVELS = ["VIEW", "EDIT", "MANAGE"] as const;
export const accessLevelSchema = z.enum(ACCESS_LEVELS);
export type AccessLevel = z.infer<typeof accessLevelSchema>;

/** The highest level each role can be given. Administrators always have every level. */
export const MAX_LEVEL_BY_ROLE: Record<UserRole, AccessLevel> = { ADMIN: "MANAGE", MANAGER: "MANAGE", EMPLOYEE: "EDIT" };

/** True when `granted` is at least `required`. */
export function levelAllows(granted: AccessLevel | null | undefined, required: AccessLevel): boolean {
  return granted != null && ACCESS_LEVELS.indexOf(granted) >= ACCESS_LEVELS.indexOf(required);
}

/** Access per area; null means no access. */
export const accessMapSchema = z.object({ CUSTOMERS: accessLevelSchema.nullable(), SALES: accessLevelSchema.nullable() });
export type AccessMap = z.infer<typeof accessMapSchema>;

export const PASSWORD_MIN = 10;
export const passwordSchema = z
  .string({ required_error: ERROR_CODES.required })
  .min(PASSWORD_MIN, ERROR_CODES.passwordTooShort)
  .max(200, ERROR_CODES.tooLong);

/** POST /auth/login */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, ERROR_CODES.required).max(254, ERROR_CODES.tooLong),
  password: z.string().min(1, ERROR_CODES.required).max(200, ERROR_CODES.tooLong),
});
export type LoginInput = z.input<typeof loginSchema>;

/** The signed-in user, as GET /auth/me returns it. */
export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  locale: crmLocaleSchema,
  access: accessMapSchema,
  /** True for administrators and for accounts given every platform. */
  allPlatforms: z.boolean(),
  /** The active platforms this account may work in, in display order. */
  platforms: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string(), color: z.string() })),
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** POST /auth/password */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, ERROR_CODES.required).max(200),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
export type ChangePassword = z.output<typeof changePasswordSchema>;

/** PATCH /auth/me */
export const updateProfileSchema = z.object({ name: text(120).optional(), locale: crmLocaleSchema.optional() });
export type UpdateProfileInput = z.input<typeof updateProfileSchema>;

// ---- Accounts (administrators only) ----

const accountFields = {
  name: text(120),
  role: userRoleSchema,
  allPlatforms: z.boolean().default(false),
  platformIds: z.array(idSchema).max(200).default([]),
  access: accessMapSchema,
  locale: crmLocaleSchema.default("en"),
};

/** Employees cannot be given MANAGE (delete) on any area. */
function checkRoleLimits(value: { role?: UserRole; access?: AccessMap }, ctx: z.RefinementCtx) {
  if (!value.role || !value.access) return;
  const max = MAX_LEVEL_BY_ROLE[value.role];
  for (const area of PERMISSION_AREAS) {
    const level = value.access[area];
    if (level && !levelAllows(max, level)) ctx.addIssue({ code: "custom", path: ["access", area], message: ERROR_CODES.invalid });
  }
}

/** POST /users */
export const createUserSchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1, ERROR_CODES.required).max(254, ERROR_CODES.tooLong).email(ERROR_CODES.email),
    password: passwordSchema,
    ...accountFields,
  })
  .superRefine(checkRoleLimits);
export type CreateUserInput = z.input<typeof createUserSchema>;

/** PATCH /users/:id */
export const updateUserSchema = z
  .object({
    name: accountFields.name.optional(),
    role: userRoleSchema.optional(),
    isActive: z.boolean().optional(),
    allPlatforms: z.boolean().optional(),
    platformIds: z.array(idSchema).max(200).optional(),
    access: accessMapSchema.optional(),
    locale: crmLocaleSchema.optional(),
  })
  .superRefine(checkRoleLimits);
export type UpdateUserInput = z.input<typeof updateUserSchema>;

/** POST /users/:id/password: the administrator sets a new password. */
export const resetPasswordSchema = z.object({ password: passwordSchema });
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const userSchema = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  role: userRoleSchema,
  isActive: z.boolean(),
  allPlatforms: z.boolean(),
  platformIds: z.array(z.string()),
  access: accessMapSchema,
  locale: crmLocaleSchema,
  lastLoginAt: z.string().nullable(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

/** People a record can be assigned to (GET /users/assignable). */
export const assignableUsersSchema = z.array(refSchema);
