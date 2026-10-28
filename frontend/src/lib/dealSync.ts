import { api, type Lead, type LeadStatusPayload } from "@/lib/api";

const NEXT: Record<string, LeadStatusPayload["status"][]> = {
  NEW: ["INTERESTED", "QUOTATION_SENT", "LOST"],
  INTERESTED: ["QUOTATION_SENT", "LOST"],
  QUOTATION_SENT: ["INTERESTED", "BOOKING_CONFIRMED", "LOST"],
  BOOKING_CONFIRMED: ["QUOTATION_SENT"],
  LOST: [],
};

/** Pipeline stage → the lead status it should line up with. */
export function leadStatusForStage(stageKey: string): LeadStatusPayload["status"] | null {
  if (stageKey === "QUALIFIED") return "INTERESTED";
  if (stageKey === "QUOTATION_SENT" || stageKey === "NEGOTIATION") return "QUOTATION_SENT";
  return null;
}

/**
 * Move the lead along allowed transitions so the sales record matches the deal.
 * Skips when the lead is already there, lost, or the jump is not allowed.
 */
export async function alignLeadWithDeal(
  lead: Lead | undefined,
  target: LeadStatusPayload["status"],
  extra?: Pick<LeadStatusPayload, "lostReason" | "note">,
): Promise<void> {
  if (!lead?.id || !lead.status || lead.status === target || lead.status === "LOST") return;
  const allowed = NEXT[lead.status] ?? [];
  if (!allowed.includes(target)) return;
  await api.updateLeadStatus(lead.id, { status: target, ...extra });
}
