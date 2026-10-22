import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import { notifications } from "../db/schema/index.js";
import { newId } from "../utils/ids.js";

export async function createNotification(input: {
  tenantId: string;
  workspaceId: string;
  userId: string;
  kind: string;
  title: string;
  body?: string;
  entityType?: string;
  entityId?: string;
}) {
  const db = getDb();
  const id = newId("ntf");
  await db.insert(notifications).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    entityType: input.entityType,
    entityId: input.entityId,
  });
  return id;
}

export async function listNotifications(workspaceId: string, userId: string, unreadOnly = false) {
  const db = getDb();
  const cond = unreadOnly
    ? and(
        eq(notifications.workspaceId, workspaceId),
        eq(notifications.userId, userId),
        isNull(notifications.readAt),
      )
    : and(eq(notifications.workspaceId, workspaceId), eq(notifications.userId, userId));
  return db.select().from(notifications).where(cond).orderBy(desc(notifications.createdAt)).limit(50);
}

export async function markNotificationRead(id: string, userId: string) {
  const db = getDb();
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
  return { ok: true };
}
