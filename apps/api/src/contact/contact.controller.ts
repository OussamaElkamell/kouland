import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { createContactMessageSchema, type ContactMessageReceipt, type CreateContactMessage } from "@kouland/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { ContactService } from "./contact.service";

@Controller("contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  /** Public: the website's contact form. Limited to 5 messages a minute per IP address. */
  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  create(@Body(new ZodValidationPipe(createContactMessageSchema)) body: CreateContactMessage): Promise<ContactMessageReceipt> {
    return this.contact.create(body);
  }
}
