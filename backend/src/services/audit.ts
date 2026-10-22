import { getDb } from "../db/client.js";
import { auditEvents } from "../db/schema/index.js";
import { newId } from "../utils/ids.js";

export async function writeAudit(input: {
  tenantId: string;
  workspaceId?: string | null;
  actorUserId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}) {
  const db = getDb();
  // Never log secrets — metadata is caller-controlled; strip common key names.
  const safe = { ...(input.metadata ?? {}) };
  for (const k of Object.keys(safe)) {
    if (/key|secret|password|token|authorization/i.test(k)) {
      delete safe[k];
    }
  }
  await db.insert(auditEvents).values({
    id: newId("aud"),
    tenantId: input.tenantId,
    workspaceId: input.workspaceId ?? null,
    actorUserId: input.actorUserId ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    metadataJson: JSON.stringify(safe),
  });
}
