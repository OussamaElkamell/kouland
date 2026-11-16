import { Global, Module, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { configureApp } from "../app.setup";
import { MailSender } from "../mail/mail-sender";
import { PrismaService } from "../prisma/prisma.service";
import { ContactModule } from "./contact.module";

const valid = { name: "Awa Diallo", email: "Awa@Example.com", message: "I need hosting for my shop." };

const create = jest.fn();
const send = jest.fn();

/** Stands in for the global PrismaModule, so the tests need no database. */
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: { contactMessage: { create } } }],
  exports: [PrismaService],
})
class FakePrismaModule {}

describe("POST /api/contact", () => {
  let app: INestApplication;

  beforeEach(async () => {
    process.env.CONTACT_INBOX_EMAIL = "contact@kouland.com";
    create.mockReset().mockResolvedValue({ id: "msg_1", createdAt: new Date("2026-11-14T10:00:00.000Z") });
    send.mockReset().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), FakePrismaModule, ContactModule],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    })
      .overrideProvider(MailSender)
      .useValue({ send })
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(() => app.close());

  it("stores a valid message and returns a receipt", async () => {
    const response = await request(app.getHttpServer()).post("/api/contact").send(valid).expect(201);
    expect(response.body).toEqual({ id: "msg_1", createdAt: "2026-11-14T10:00:00.000Z" });
    expect(create).toHaveBeenCalledWith({
      data: { name: "Awa Diallo", email: "awa@example.com", message: "I need hosting for my shop." },
      select: { id: true, createdAt: true },
    });
  });

  it("emails the message to the company inbox with the visitor as reply-to", async () => {
    await request(app.getHttpServer()).post("/api/contact").send(valid).expect(201);
    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0][0];
    expect(mail.to).toEqual([{ email: "contact@kouland.com", name: "Kouland Technology" }]);
    expect(mail.replyTo).toEqual({ email: "awa@example.com", name: "Awa Diallo" });
    expect(mail.subject).toBe("Website message from Awa Diallo");
    expect(mail.text).toContain("I need hosting for my shop.");
    expect(mail.tag).toBe("contact-message");
  });

  it("still saves the message and answers 201 when the email fails", async () => {
    send.mockRejectedValue(new Error("Brevo 401 unauthorized"));
    const response = await request(app.getHttpServer()).post("/api/contact").send(valid).expect(201);
    expect(response.body.id).toBe("msg_1");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("saves without emailing when no inbox is configured", async () => {
    delete process.env.CONTACT_INBOX_EMAIL;
    await request(app.getHttpServer()).post("/api/contact").send(valid).expect(201);
    expect(create).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects invalid input with per-field errors and stores nothing", async () => {
    const response = await request(app.getHttpServer())
      .post("/api/contact")
      .send({ name: "A", email: "nope", message: "hi" })
      .expect(400);
    expect(response.body.statusCode).toBe(400);
    expect(Object.keys(response.body.fieldErrors).sort()).toEqual(["email", "message", "name"]);
    expect(create).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("drops fields that are not part of the contract", async () => {
    await request(app.getHttpServer()).post("/api/contact").send({ ...valid, isAdmin: true }).expect(201);
    expect(create.mock.calls[0][0].data).not.toHaveProperty("isAdmin");
  });

  it("limits one address to 5 messages a minute", async () => {
    for (let i = 0; i < 5; i++) await request(app.getHttpServer()).post("/api/contact").send(valid).expect(201);
    const response = await request(app.getHttpServer()).post("/api/contact").send(valid).expect(429);
    expect(response.body.statusCode).toBe(429);
  });

  it("hides unexpected errors behind a generic 500", async () => {
    create.mockRejectedValue(new Error("connection refused: postgres://secret"));
    const response = await request(app.getHttpServer()).post("/api/contact").send(valid).expect(500);
    expect(response.body).toEqual({ statusCode: 500, message: "Something went wrong. Please try again." });
  });
});
