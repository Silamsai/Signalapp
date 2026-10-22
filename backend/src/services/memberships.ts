import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  memberships,
  users,
  workspaces,
  type MembershipRole,
  membershipRoles,
} from "../db/schema/index.js";
import { conflict, forbidden, notFound, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { hashPassword } from "../auth/password.js";
import { writeAudit } from "./audit.js";
import { randomBytes } from "node:crypto";

export async function listMemberships(workspaceId: string) {
  const db = getDb();
  return db
    .select({
      id: memberships.id,
      userId: memberships.userId,
      role: memberships.role,
      revokedAt: memberships.revokedAt,
      createdAt: memberships.createdAt,
      email: users.email,
      name: users.name,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(eq(memberships.workspaceId, workspaceId), isNull(memberships.revokedAt)));
}

export async function grantMembership(input: {
  tenantId: string;
  workspaceId: string;
  email: string;
  name?: string;
  role: MembershipRole;
  actorUserId: string;
}) {
  if (!membershipRoles.includes(input.role)) {
    throw validationError("Invalid role");
  }
  const db = getDb();
  const [ws] = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, input.workspaceId), eq(workspaces.tenantId, input.tenantId)))
    .limit(1);
  if (!ws) throw notFound("Workspace not found");

  const email = input.email.trim().toLowerCase();
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let temporaryPassword: string | undefined;

  if (!user) {
    temporaryPassword = randomBytes(9).toString("base64url");
    const userId = newId("usr");
    await db.insert(users).values({
      id: userId,
      email,
      name: input.name?.trim() || email.split("@")[0] || "User",
      passwordHash: await hashPassword(temporaryPassword),
    });
    [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  }

  const existing = await db
    .select()
    .from(memberships)
    .where(and(eq(memberships.userId, user!.id), eq(memberships.workspaceId, input.workspaceId)))
    .limit(1);

  if (existing[0] && !existing[0].revokedAt) {
    throw conflict("User already has access to this workspace");
  }

  if (existing[0]?.revokedAt) {
    await db
      .update(memberships)
      .set({ revokedAt: null, role: input.role })
      .where(eq(memberships.id, existing[0].id));
    await writeAudit({
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      actorUserId: input.actorUserId,
      action: "membership.regranted",
      entityType: "membership",
      entityId: existing[0].id,
      metadata: { email, role: input.role },
    });
    return {
      membership: { ...existing[0], role: input.role, revokedAt: null },
      temporaryPassword,
    };
  }

  const id = newId("mem");
  await db.insert(memberships).values({
    id,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    userId: user!.id,
    role: input.role,
  });

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "membership.granted",
    entityType: "membership",
    entityId: id,
    metadata: { email, role: input.role },
  });

  const [row] = await db.select().from(memberships).where(eq(memberships.id, id)).limit(1);
  return { membership: row!, temporaryPassword };
}

export async function revokeMembership(input: {
  tenantId: string;
  workspaceId: string;
  membershipId: string;
  actorUserId: string;
}) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.id, input.membershipId),
        eq(memberships.workspaceId, input.workspaceId),
        eq(memberships.tenantId, input.tenantId),
      ),
    )
    .limit(1);
  if (!row) throw notFound("Membership not found");
  if (row.userId === input.actorUserId) {
    throw forbidden("Cannot revoke your own membership");
  }
  if (row.revokedAt) return row;

  await db
    .update(memberships)
    .set({ revokedAt: new Date() })
    .where(eq(memberships.id, row.id));

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "membership.revoked",
    entityType: "membership",
    entityId: row.id,
  });

  const [updated] = await db.select().from(memberships).where(eq(memberships.id, row.id)).limit(1);
  return updated!;
}
