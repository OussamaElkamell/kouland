import cancellation from "./cancellation.json";
import privacy from "./privacy.json";
import terms from "./terms.json";

/**
 * The company's policies, imported from koulandtechnology.com (see `source` in each JSON file).
 * They stay in English in every language: a legal text is translated by a professional, not by us.
 * The old contact details at the end of each page were left out; the pages show the current ones from COMPANY.
 */
export type LegalBlock = { type: "p"; text: string } | { type: "list"; items: string[] };
export type LegalSection = { heading?: string; blocks: LegalBlock[] };
export type LegalDocument = { source: string; importedOn: string; effective: string | null; sections: LegalSection[] };

/** Keys into `legal.<key>` in the messages; the paths are the same as on the old website. */
export const LEGAL_DOCUMENTS = {
  privacy: { path: "/privacy", document: privacy as LegalDocument },
  terms: { path: "/terms-of-service", document: terms as LegalDocument },
  cancellation: { path: "/cancellation-policy", document: cancellation as LegalDocument },
} as const;

export type LegalKey = keyof typeof LEGAL_DOCUMENTS;
export const LEGAL_KEYS = Object.keys(LEGAL_DOCUMENTS) as LegalKey[];

/** Anchor id for a section heading, e.g. "Cancellation/Refund Policy" → "cancellation-refund-policy". */
export const sectionId = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
