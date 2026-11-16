import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import type { ApiErrorBody } from "@kouland/contracts";
import type { Response } from "express";

/** Sends every error as the `ApiErrorBody` contract. Unexpected errors are logged and hidden from the client. */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toBody(exception);
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorBody {
    if (!(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
      return { statusCode: HttpStatus.INTERNAL_SERVER_ERROR, message: "Something went wrong. Please try again." };
    }

    const statusCode = exception.getStatus();
    const payload = exception.getResponse();
    if (typeof payload === "string") return { statusCode, message: payload };

    const { message, fieldErrors } = payload as { message?: unknown; fieldErrors?: ApiErrorBody["fieldErrors"] };
    return {
      statusCode,
      message: Array.isArray(message) ? message.join(". ") : typeof message === "string" ? message : exception.message,
      ...(fieldErrors ? { fieldErrors } : {}),
    };
  }
}
