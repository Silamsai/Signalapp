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
  | "tasks"
  | "drafts"
  | "view_outcomes"
  | "view_reports";

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
    "tasks",
    "drafts",
    "view_outcomes",
    "view_reports",
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
  ],
  sdr: ["qualify", "tasks", "drafts", "view_outcomes"],
  sales_reviewer: [
    "accept",
    "assign_owner",
    "handoff",
    "share_handoff",
    "qualify",
    "tasks",
    "view_outcomes",
    "view_reports",
  ],
  partner: ["view_outcomes"],
  analyst: ["view_outcomes", "view_reports"],
};

export function hasCapability(role: MembershipRole, cap: Capability): boolean {
  return roleCaps[role]?.includes(cap) ?? false;
}
