import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "../db/client.js";
import {
  memberships,
  sessions,
  users,
  workspaces,
  type MembershipRole,
  membershipRoles,
} from "../db/schema/index.js";
import { conflict, forbidden, notFound, validationError } from "../utils/errors.js";
import { newId } from "../utils/ids.js";
import { hashPassword } from "../auth/password.js";
import { writeAudit } from "./audit.js";
import { forgetMemberships } from "../middleware/requireMembership.js";
import { forgetUserSessions } from "../auth/session.js";

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
  /** Admin-chosen password, required when the email has no account yet */
  password?: string;
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
  // An existing account keeps its own password; only new people get the admin's one
  const existingAccount = Boolean(user);

  if (!user) {
    if (!input.password || input.password.length < 8) {
      throw validationError("Set a password of at least 8 characters for this new member");
    }
    const userId = newId("usr");
    await db.insert(users).values({
      id: userId,
      email,
      name: input.name?.trim() || email.split("@")[0] || "User",
      passwordHash: await hashPassword(input.password),
    });
    [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  } else if (user.isPlatformAdmin) {
    // The app owner's account stays outside every tenant, so no tenant admin can manage it
    throw forbidden("This email belongs to the platform admin and can't be added to a workspace");
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
    forgetMemberships();
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
      existingAccount,
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
  forgetMemberships();

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
  return { membership: row!, existingAccount };
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
  forgetMemberships();

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

/**
 * Admin sets a new password for a member (no forced change; they can change it
 * themselves later). Allowed only when every active membership
 * of that user belongs to the admin's tenant, so one tenant can never take over
 * an account that also has access to another tenant.
 */
export async function resetMemberPassword(input: {
  tenantId: string;
  workspaceId: string;
  membershipId: string;
  newPassword: string;
  actorUserId: string;
}) {
  if (input.newPassword.length < 8) throw validationError("Password must be at least 8 characters");
  const db = getDb();
  const [row] = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.id, input.membershipId),
        eq(memberships.workspaceId, input.workspaceId),
        eq(memberships.tenantId, input.tenantId),
        isNull(memberships.revokedAt),
      ),
    )
    .limit(1);
  if (!row) throw notFound("Membership not found");
  if (row.userId === input.actorUserId) {
    throw forbidden("Use “Change password” to change your own password");
  }
  const others = await db
    .select({ tenantId: memberships.tenantId })
    .from(memberships)
    .where(and(eq(memberships.userId, row.userId), isNull(memberships.revokedAt)));
  if (others.some((m) => m.tenantId !== input.tenantId)) {
    throw forbidden("This person also belongs to another organization; they must reset it themselves");
  }
  const [target] = await db.select({ isPlatformAdmin: users.isPlatformAdmin }).from(users).where(eq(users.id, row.userId)).limit(1);
  if (target?.isPlatformAdmin) throw forbidden("The platform admin's password can't be reset from a workspace");

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(input.newPassword),
      mustChangePassword: false,
      passwordChangedAt: new Date(),
    })
    .where(eq(users.id, row.userId));
  // Sign the person out everywhere
  await db.delete(sessions).where(eq(sessions.userId, row.userId));
  forgetUserSessions(row.userId);

  await writeAudit({
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    action: "membership.password_reset",
    entityType: "membership",
    entityId: row.id,
  });
  return { ok: true };
}
