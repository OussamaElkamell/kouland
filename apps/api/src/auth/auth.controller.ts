import { Body, Controller, Get, HttpCode, Patch, Post, Req, Res } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  changePasswordSchema,
  loginSchema,
  updateProfileSchema,
  type ChangePassword,
  type SessionUser,
  type UpdateProfileInput,
} from "@kouland/contracts";
import type { Request, Response } from "express";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CurrentUser, type AuthUser } from "./auth-user";
import { AuthService } from "./auth.service";
import { Crm } from "./crm.guard";
import { SessionService } from "./session.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  /** Signs in and sets the session cookie. Limited to 10 attempts a minute per IP address. */
  @Post("login")
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: { email: string; password: string },
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<SessionUser> {
    const { id } = await this.auth.checkCredentials(body.email, body.password);
    const user = await this.sessions.create(id, request.headers["user-agent"], response);
    return this.auth.me(user);
  }

  @Post("logout")
  @HttpCode(204)
  @Crm()
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response): Promise<void> {
    await this.sessions.destroy(user.sessionId, response);
  }

  @Get("me")
  @Crm()
  me(@CurrentUser() user: AuthUser): Promise<SessionUser> {
    return this.auth.me(user);
  }

  /** The account's own name and CRM language. */
  @Patch("me")
  @Crm()
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<SessionUser> {
    return this.auth.updateProfile(user, body);
  }

  @Post("password")
  @HttpCode(204)
  @Crm()
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(changePasswordSchema)) body: ChangePassword,
  ): Promise<void> {
    return this.auth.changePassword(user, body);
  }
}
