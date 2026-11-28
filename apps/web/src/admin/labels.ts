import type { AppointmentStatus, CustomerStage, OpportunityStatus, ProposalStatus, TicketPriority, TicketStatus } from "@kouland/contracts";
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

export const TICKET_STATUS_TONE: Record<TicketStatus, Tone> = {
  OPEN: "info",
  IN_PROGRESS: "brand",
  WAITING_ON_CUSTOMER: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

export const TICKET_PRIORITY_TONE: Record<TicketPriority, Tone> = { LOW: "neutral", NORMAL: "info", HIGH: "warning", URGENT: "error" };

export const APPOINTMENT_TONE: Record<AppointmentStatus, Tone> = { SCHEDULED: "info", COMPLETED: "success", CANCELLED: "neutral" };
