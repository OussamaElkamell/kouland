import { Global, Module, type INestApplication } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { Test } from "@nestjs/testing";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import request from "supertest";
import { configureApp } from "../app.setup";
import { MailSender } from "../mail/mail-sender";
import { PrismaService } from "../prisma/prisma.service";
import { CareersModule } from "./careers.module";

const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const application = {
  fullName: "Awa Diallo",
  email: "Awa@Example.com",
  phone: "+1 555 0100",
  city: "Tulsa",
  country: "United States",
  area: "tech",
  position: "Field technician",
  employmentType: "fullTime",
  workMode: "onSite",
  experienceLevel: "3to5",
  skills: "TV mounting, home networks",
  motivation: "I have installed home theaters and smart home systems for four years and enjoy explaining technology.",
  availableFrom: tomorrow,
  consent: true,
};
const pdf = Buffer.from("%PDF-1.7\n1 0 obj\n<<>>\nendobj\n");

const create = jest.fn();
const send = jest.fn();

/** Stands in for the global PrismaModule, so the tests need no database. */
@Global()
@Module({
  providers: [{ provide: PrismaService, useValue: { jobApplication: { create } } }],
  exports: [PrismaService],
})
class FakePrismaModule {}

describe("POST /api/careers/applications", () => {
  let app: INestApplication;

  const post = () => request(app.getHttpServer()).post("/api/careers/applications");
  const submit = (fields: object = application, file: Buffer | null = pdf, fileName = "cv.pdf", contentType = "application/pdf") => {
    const req = post().field("application", JSON.stringify(fields)).field("locale", "fr");
    return file ? req.attach("cv", file, { filename: fileName, contentType }) : req;
  };

  beforeEach(async () => {
    process.env.CONTACT_INBOX_EMAIL = "contact@kouland.com";
    delete process.env.CAREERS_INBOX_EMAIL;
    create.mockReset().mockResolvedValue({ id: "app_1", createdAt: new Date("2026-11-17T10:00:00.000Z") });
    send.mockReset().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]), FakePrismaModule, CareersModule],
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

  it("stores the application with its CV and returns a receipt", async () => {
    const response = await submit().expect(201);
    expect(response.body).toEqual({ id: "app_1", createdAt: "2026-11-17T10:00:00.000Z" });
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ email: "awa@example.com", area: "tech", locale: "fr", cvMimeType: "application/pdf", cvSize: pdf.length });
    expect(Buffer.compare(data.cvData, pdf)).toBe(0);
    expect(data).not.toHaveProperty("consent");
    expect(data.consentAt).toBeInstanceOf(Date);
  });

  it("emails the application with the CV attached and the applicant as reply-to", async () => {
    await submit().expect(201);
    const mail = send.mock.calls[0][0];
    expect(mail.to).toEqual([{ email: "contact@kouland.com", name: "Kouland Technology" }]);
    expect(mail.replyTo).toEqual({ email: "awa@example.com", name: "Awa Diallo" });
    expect(mail.subject).toBe("Job application: Field technician (KoulandTech) from Awa Diallo");
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0].name).toBe("CV - Awa Diallo.pdf");
  });

  it("uses CAREERS_INBOX_EMAIL when it is set", async () => {
    process.env.CAREERS_INBOX_EMAIL = "jobs@kouland.com";
    await submit().expect(201);
    expect(send.mock.calls[0][0].to[0].email).toBe("jobs@kouland.com");
  });

  it("still answers 201 when the email fails", async () => {
    send.mockRejectedValue(new Error("Brevo 400"));
    await submit().expect(201);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("requires a CV", async () => {
    const response = await submit(application, null).expect(400);
    expect(response.body.fieldErrors).toEqual({ cv: ["missing"] });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a file that is not really a PDF or Word document", async () => {
    const response = await submit(application, Buffer.from("MZ fake executable"), "cv.pdf", "application/pdf").expect(400);
    expect(response.body.fieldErrors).toEqual({ cv: ["wrongType"] });
    const image = await submit(application, Buffer.from([0x89, 0x50, 0x4e, 0x47]), "cv.png", "image/png").expect(400);
    expect(image.body.fieldErrors).toEqual({ cv: ["wrongType"] });
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses a CV over 5 MB", async () => {
    const big = Buffer.concat([pdf, Buffer.alloc(5 * 1024 * 1024)]);
    const response = await submit(application, big).expect(413);
    expect(response.body.statusCode).toBe(413);
    expect(create).not.toHaveBeenCalled();
  });

  it("refuses an incomplete application with per-field errors", async () => {
    const response = await submit({ ...application, motivation: "Short", consent: false }).expect(400);
    expect(Object.keys(response.body.fieldErrors).sort()).toEqual(["consent", "motivation"]);
    expect(create).not.toHaveBeenCalled();
  });

  it("limits one address to 3 applications a minute", async () => {
    for (let i = 0; i < 3; i++) await submit().expect(201);
    await submit().expect(429);
  });
});
