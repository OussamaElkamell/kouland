import type { CustomerStage, OpportunityStatus, ProposalStatus } from "@kouland/contracts";
import type { Tone } from "./ui";

/** Badge colour per status. The words come from the messages (`status.*`). */
export const OPPORTUNITY_TONE: Record<OpportunityStatus, Tone> = {
  NEW: "info",
  CONTACTED: "neutral",
  QUALIFIED: "brand",
  PROPOSAL_SENT: "warning",
  NEGOTIATION: "warning",
  WON: "success",
  LOST: "error",
};

export const PROPOSAL_TONE: Record<ProposalStatus, Tone> = {
  DRAFT: "neutral",
  SENT: "info",
  ACCEPTED: "success",
  REJECTED: "error",
};

export const STAGE_TONE: Record<CustomerStage, Tone> = { PROSPECT: "warning", CUSTOMER: "success" };
