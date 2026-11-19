import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { configureApp } from "../app.setup";
import { platformScope, type AuthUser } from "./auth-user";
import { AdminOnly, Crm, CrmGuard, RequireAccess } from "./crm.guard";
import { SessionService } from "./session.service";

@Controller("probe")
@Crm()
class ProbeController {
  @Get("view")
  @RequireAccess("CUSTOMERS", "VIEW")
  view() {
    return { ok: true };
  }

  @Get("delete")
  @RequireAccess("CUSTOMERS", "MANAGE")
  remove() {
    return { ok: true };
  }

  @Get("admin")
  @AdminOnly()
  admin() {
    return { ok: true };
  }
}

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: "u1",
  email: "e@kouland.test",
  name: "E",
  role: "EMPLOYEE",
  locale: "en",
  access: { CUSTOMERS: "EDIT", SALES: null },
  allPlatforms: false,
  platformIds: ["p1"],
  sessionId: "s1",
  ...overrides,
});

describe("CrmGuard", () => {
  let app: INestApplication;
  const resolve = jest.fn();

  beforeEach(async () => {
    resolve.mockReset();
    const moduleRef = await Test.createTestingModule({
      controllers: [ProbeController],
      providers: [CrmGuard, { provide: SessionService, useValue: { resolve } }],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(() => app.close());

  it("answers 401 without a session", async () => {
    resolve.mockResolvedValue(null);
    const response = await request(app.getHttpServer()).get("/api/probe/view").expect(401);
    expect(response.body.statusCode).toBe(401);
  });

  it("lets an account through when its level is high enough", async () => {
    resolve.mockResolvedValue(user());
    await request(app.getHttpServer()).get("/api/probe/view").expect(200);
  });

  it("answers 403 when the level is too low", async () => {
    resolve.mockResolvedValue(user());
    await request(app.getHttpServer()).get("/api/probe/delete").expect(403);
  });

  it("keeps administrator routes for administrators", async () => {
    resolve.mockResolvedValue(user({ role: "MANAGER", access: { CUSTOMERS: "MANAGE", SALES: "MANAGE" } }));
    await request(app.getHttpServer()).get("/api/probe/admin").expect(403);
    resolve.mockResolvedValue(user({ role: "ADMIN", allPlatforms: true }));
    await request(app.getHttpServer()).get("/api/probe/admin").expect(200);
  });
});

describe("platformScope", () => {
  it("is null (everything) for administrators and all-platform accounts", () => {
    expect(platformScope(user({ role: "ADMIN" }))).toBeNull();
    expect(platformScope(user({ allPlatforms: true }))).toBeNull();
  });

  it("is the given platforms otherwise", () => {
    expect(platformScope(user())).toEqual(["p1"]);
  });
});
