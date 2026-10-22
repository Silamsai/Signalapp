import type { MembershipRole } from "../db/schema/identity.js";

export type Capability =
  | "manage_membership"
  | "manage_settings"
  | "discover"
  | "import"
  | "research"
  | "qualify"
  | "submit_review"
  | "accept"
  | "assign_owner"
  | "handoff"
  | "share_handoff"
  | "acknowledge_handoff"
  | "tasks"
  | "drafts"
  | "view_outcomes"
  | "view_reports"
  | "manage_monitors"
  | "manage_entitlements"
  | "campaign_operate"
  | "campaign_approve"
  | "manage_sending"
  | "manage_score_models";

const roleCaps: Record<MembershipRole, Capability[]> = {
  tenant_admin: [
    "manage_membership",
    "manage_settings",
    "discover",
    "import",
    "research",
    "qualify",
    "submit_review",
    "accept",
    "assign_owner",
    "handoff",
    "share_handoff",
    "acknowledge_handoff",
    "tasks",
    "drafts",
    "view_outcomes",
    "view_reports",
    "manage_monitors",
    "manage_entitlements",
    "campaign_operate",
    "campaign_approve",
    "manage_sending",
    "manage_score_models",
  ],
  researcher: [
    "discover",
    "import",
    "research",
    "qualify",
    "submit_review",
    "tasks",
    "drafts",
    "view_outcomes",
    "manage_monitors",
  ],
  sdr: ["qualify", "tasks", "drafts", "view_outcomes", "campaign_operate"],
  sales_reviewer: [
    "accept",
    "assign_owner",
    "handoff",
    "share_handoff",
    "acknowledge_handoff",
    "qualify",
    "tasks",
    "view_outcomes",
    "view_reports",
    "campaign_approve",
  ],
  partner: ["view_outcomes", "acknowledge_handoff"],
  analyst: ["view_outcomes", "view_reports", "manage_score_models"],
};

export function hasCapability(role: MembershipRole, cap: Capability): boolean {
  return roleCaps[role]?.includes(cap) ?? false;
}
