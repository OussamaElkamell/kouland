import { CV_MAX_BYTES, CV_TYPES, type CvMimeType } from "@kouland/contracts";

/** The first bytes of each accepted CV format, so a renamed file of another type is refused. */
const SIGNATURES: Record<CvMimeType, number[]> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46], // %PDF
  "application/msword": [0xd0, 0xcf, 0x11, 0xe0], // OLE compound file (Word 97–2003)
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [0x50, 0x4b, 0x03, 0x04], // ZIP (Word .docx)
};

export interface UploadedCv {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export type CvProblem = "missing" | "tooLarge" | "wrongType";

/** Checks the uploaded CV: present, at most 5 MB, a PDF or Word file by both its declared type and its content. */
export function checkCv(file: UploadedCv | undefined): { ok: true; mimeType: CvMimeType } | { ok: false; problem: CvProblem } {
  if (!file || file.size === 0) return { ok: false, problem: "missing" };
  if (file.size > CV_MAX_BYTES) return { ok: false, problem: "tooLarge" };
  if (!(file.mimetype in CV_TYPES)) return { ok: false, problem: "wrongType" };
  const mimeType = file.mimetype as CvMimeType;
  const signature = SIGNATURES[mimeType];
  const matches = signature.every((byte, index) => file.buffer[index] === byte);
  return matches ? { ok: true, mimeType } : { ok: false, problem: "wrongType" };
}

/** A safe file name for the email attachment, e.g. "CV - Awa Diallo.pdf". */
export function cvAttachmentName(fullName: string, mimeType: CvMimeType): string {
  const safeName = fullName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .slice(0, 80);
  return `CV - ${safeName || "applicant"}${CV_TYPES[mimeType]}`;
}
