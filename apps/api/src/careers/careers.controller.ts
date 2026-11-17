import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Throttle } from "@nestjs/throttler";
import {
  APPLICATION_FORM_FIELDS,
  applicationLocaleSchema,
  CV_MAX_BYTES,
  jobApplicationSchema,
  type ApiErrorBody,
  type JobApplication,
  type JobApplicationReceipt,
} from "@kouland/contracts";
import { ZodValidationPipe } from "../common/zod-validation.pipe";
import { CareersService } from "./careers.service";
import { checkCv, type UploadedCv } from "./cv-file";

/** The application arrives as a JSON string inside the multipart form; this turns it back into an object. */
class ParseJsonPipe {
  transform(value: unknown): unknown {
    if (typeof value !== "string") return value;
    try {
      return JSON.parse(value) as unknown;
    } catch {
      const body: ApiErrorBody = { statusCode: 400, message: "The application could not be read. Please try again." };
      throw new BadRequestException(body);
    }
  }
}

/** Messages for a refused CV. The website shows its own translated text for the `cv` field. */
const CV_MESSAGES = {
  missing: "Attach your CV.",
  tooLarge: "Your CV must be 5 MB or smaller.",
  wrongType: "Your CV must be a PDF or Word file.",
} as const;

@Controller("careers")
export class CareersController {
  constructor(private readonly careers: CareersService) {}

  /**
   * Public: the website's job application form (multipart/form-data, see APPLICATION_FORM_FIELDS). The CV is kept
   * in memory (at most 5 MB) and stored in the database. Limited to 3 applications a minute per IP address.
   */
  @Post("applications")
  @Throttle({ default: { ttl: 60_000, limit: 3 } })
  @UseInterceptors(FileInterceptor(APPLICATION_FORM_FIELDS.cv, { limits: { fileSize: CV_MAX_BYTES, files: 1, fields: 5 } }))
  apply(
    @Body(APPLICATION_FORM_FIELDS.application, new ParseJsonPipe(), new ZodValidationPipe(jobApplicationSchema)) application: JobApplication,
    @Body(APPLICATION_FORM_FIELDS.locale) locale: unknown,
    @UploadedFile() cv: UploadedCv | undefined,
  ): Promise<JobApplicationReceipt> {
    const checked = checkCv(cv);
    if (!checked.ok || !cv) {
      const problem = checked.ok ? "missing" : checked.problem;
      const body: ApiErrorBody = { statusCode: 400, message: CV_MESSAGES[problem], fieldErrors: { cv: [problem] } };
      throw new BadRequestException(body);
    }
    return this.careers.apply(application, cv, checked.mimeType, applicationLocaleSchema.parse(locale));
  }
}
