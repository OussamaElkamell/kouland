import {
  applyDecorators,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { levelAllows, type AccessLevel, type PermissionArea } from "@kouland/contracts";
import type { AuthenticatedRequest } from "./auth-user";
import { SessionService } from "./session.service";

const ACCESS_KEY = "crm:access";
const ADMIN_KEY = "crm:admin";

/** The route needs at least `level` on `area` (VIEW to read, EDIT to create or change, MANAGE to delete). */
export const RequireAccess = (area: PermissionArea, level: AccessLevel) => SetMetadata(ACCESS_KEY, { area, level });
/** The route is for administrators only (accounts, platform settings). */
export const AdminOnly = () => SetMetadata(ADMIN_KEY, true);

/**
 * Every CRM route goes through this guard: it signs the request in from the session cookie (401 without one) and
 * checks the route's RequireAccess / AdminOnly rule (403). Record-level checks (which platforms the account may
 * see) are done by the services with platformScope().
 */
@Injectable()
export class CrmGuard implements CanActivate {
  constructor(
    private readonly sessions: SessionService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.sessions.resolve(request);
    if (!user) throw new UnauthorizedException("Please sign in.");
    request.user = user;

    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(ADMIN_KEY, targets) && user.role !== "ADMIN") {
      throw new ForbiddenException("Only administrators can do this.");
    }
    const rule = this.reflector.getAllAndOverride<{ area: PermissionArea; level: AccessLevel }>(ACCESS_KEY, targets);
    if (rule && !levelAllows(user.access[rule.area], rule.level)) {
      throw new ForbiddenException("You do not have access to this.");
    }
    return true;
  }
}

/** Marks a controller (or route) as part of the private CRM. */
export const Crm = () => applyDecorators(UseGuards(CrmGuard));
