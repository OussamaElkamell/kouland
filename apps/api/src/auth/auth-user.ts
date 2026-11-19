import { createParamDecorator, type ExecutionContext } from "@nestjs/common";
import type { AccessMap, UserRole } from "@kouland/contracts";

/** The signed-in account, attached to the request by SessionGuard. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  locale: string;
  access: AccessMap;
  allPlatforms: boolean;
  /** Platforms the account was given (ignored when allPlatforms). */
  platformIds: string[];
  sessionId: string;
}

export type AuthenticatedRequest = { user?: AuthUser; headers: Record<string, string | string[] | undefined> };

/** `@CurrentUser() user: AuthUser` in a controller guarded by SessionGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthUser => {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (!user) throw new Error("CurrentUser used on a route without SessionGuard");
  return user;
});

/**
 * Platforms the account may see: null means all of them. Every list and record check filters with this, so a
 * manager given one platform never sees another platform's customers or opportunities.
 */
export function platformScope(user: AuthUser): string[] | null {
  return user.role === "ADMIN" || user.allPlatforms ? null : user.platformIds;
}

export function canUsePlatform(user: AuthUser, platformId: string): boolean {
  const scope = platformScope(user);
  return scope === null || scope.includes(platformId);
}
