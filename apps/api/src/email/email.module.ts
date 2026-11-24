import { Body, Controller, Delete, Get, HttpCode, Logger, Module, Param, Post, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import { sendEmailSchema, type CustomerEmails, type EmailConnection, type EmailMessage } from "@kouland/contracts";
import type { z } from "zod";
import { CurrentUser, type AuthUser } from "../auth/auth-user";
import { Crm, RequireAccess } from "../auth/crm.guard";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { appUrl } from "../common/urls";
import { CustomersModule } from "../customers/customers.module";
import { EmailService } from "./email.service";

/** The signed-in person's own mailbox. The connect and callback routes are opened by the browser, not fetched. */
@Controller("email")
@Crm()
export class EmailController {
  private readonly logger = new Logger(EmailController.name);

  constructor(private readonly email: EmailService) {}

  @Get("connection")
  connection(@CurrentUser() user: AuthUser): Promise<EmailConnection> {
    return this.email.connection(user);
  }

  @Delete("connection")
  @HttpCode(204)
  disconnect(@CurrentUser() user: AuthUser): Promise<void> {
    return this.email.disconnect(user);
  }

  /** Sends the browser to Google's or Microsoft's consent page. */
  @Get("connect/:provider")
  connect(@CurrentUser() user: AuthUser, @Param("provider") provider: string, @Res() res: Response): void {
    try {
      res.redirect(this.email.startUrl(user, provider));
    } catch (error) {
      res.redirect(`${appUrl()}/admin/account?email=error&reason=${encodeURIComponent(error instanceof Error ? error.message : "error")}`);
    }
  }

  /** Where the provider sends the browser back; then back to the CRM's account page. */
  @Get("oauth/:provider/callback")
  async callback(
    @CurrentUser() user: AuthUser,
    @Param("provider") provider: string,
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") denied: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const back = `${appUrl()}/admin/account`;
    if (denied) return res.redirect(`${back}?email=denied`);
    try {
      await this.email.finish(user, provider, code, state);
      res.redirect(`${back}?email=connected`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "error";
      this.logger.warn(`Mailbox connection for ${user.email} failed: ${reason}`);
      res.redirect(`${back}?email=error&reason=${encodeURIComponent(reason.slice(0, 200))}`);
    }
  }

  @Get("messages/:id")
  message(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<EmailMessage> {
    return this.email.message(user, id);
  }
}

/** Emails with one customer, from the person's own mailbox. */
@Controller("customers/:id/emails")
@Crm()
export class CustomerEmailsController {
  constructor(private readonly email: EmailService) {}

  @Get()
  @RequireAccess("CUSTOMERS", "VIEW")
  list(@CurrentUser() user: AuthUser, @Param("id") id: string): Promise<CustomerEmails> {
    return this.email.forCustomer(user, id);
  }

  @Post()
  @HttpCode(204)
  @RequireAccess("CUSTOMERS", "EDIT")
  send(@CurrentUser() user: AuthUser, @Param("id") id: string, @Body(new ZodValidationPipe(sendEmailSchema)) body: z.output<typeof sendEmailSchema>): Promise<void> {
    return this.email.send(user, id, body);
  }
}

@Module({
  imports: [CustomersModule],
  controllers: [EmailController, CustomerEmailsController],
  providers: [EmailService],
})
export class EmailModule {}
