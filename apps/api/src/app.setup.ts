import type { INestApplication } from "@nestjs/common";
import { ApiExceptionFilter } from "./common/api-exception.filter";

/** Routing and error formatting shared by the real server (main.ts) and the HTTP tests. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix("api");
  app.useGlobalFilters(new ApiExceptionFilter());
}
