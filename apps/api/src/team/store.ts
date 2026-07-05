import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  CreateTeamInviteInput,
  SyncTeamOwnerInput,
  TeamData,
  TeamInviteRecord,
  TeamMemberRecord,
  TeamResponse,
  TeamRole,
} from '@creator-ai-studio/shared';
import { resolveStoragePath } from '../storage/index.js';

const EMPTY_TEAM: TeamData = {
  members: [],
  invites: [],
};

function teamPath(): string {
  return path.join(resolveStoragePath(), '..', 'team.json');
}

function avatarInitial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function readTeam(): Promise<TeamData> {
  const file = teamPath();
  if (!existsSync(file)) {
    await writeTeam(EMPTY_TEAM);
    return { ...EMPTY_TEAM, members: [], invites: [] };
  }
  const raw = JSON.parse(await readFile(file, 'utf8')) as TeamData;
  return {
    ownerUserId: raw.ownerUserId,
    members: Array.isArray(raw.members) ? raw.members : [],
    invites: Array.isArray(raw.invites) ? raw.invites : [],
  };
}

async function writeTeam(team: TeamData): Promise<void> {
  const file = teamPath();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(team, null, 2)}\n`, 'utf8');
  const { rename } = await import('node:fs/promises');
  await rename(tmp, file);
}

function canManageTeam(team: TeamData, userId?: string): boolean {
  if (!team.ownerUserId) return true;
  if (!userId) return false;
  return team.ownerUserId === userId;
}

function findOwner(team: TeamData): TeamMemberRecord | undefined {
  return team.members.find(m => m.role === 'owner');
}

export async function getTeamResponse(userId?: string): Promise<TeamResponse> {
  const team = await readTeam();
  return {
    ...team,
    currentUserId: userId,
    canManage: canManageTeam(team, userId),
  };
}

export async function syncTeamOwner(
  input: SyncTeamOwnerInput,
  userId?: string,
): Promise<TeamResponse> {
  const team = await readTeam();
  const email = normalizeEmail(input.email);
  const displayName = input.displayName.trim() || email.split('@')[0] || 'Usuario';
  const now = new Date().toISOString();

  if (team.ownerUserId && userId && team.ownerUserId !== userId) {
    throw new TeamStoreError('forbidden', 'Solo el propietario puede actualizar el equipo');
  }

  const existingOwner = findOwner(team);
  if (existingOwner) {
    const index = team.members.findIndex(m => m.id === existingOwner.id);
    team.members[index] = {
      ...existingOwner,
      userId: userId ?? existingOwner.userId,
      email,
      displayName,
      avatarInitial: avatarInitial(displayName),
      lastActiveAt: now,
    };
    if (userId) {
      team.ownerUserId = userId;
    }
  } else {
    const owner: TeamMemberRecord = {
      id: randomUUID(),
      userId,
      email,
      displayName,
      role: 'owner',
      avatarInitial: avatarInitial(displayName),
      joinedAt: now,
      lastActiveAt: now,
    };
    team.members.unshift(owner);
    if (userId) {
      team.ownerUserId = userId;
    }
  }

  await writeTeam(team);
  return getTeamResponse(userId);
}

export async function createTeamInvite(
  input: CreateTeamInviteInput,
  userId?: string,
): Promise<TeamResponse> {
  const team = await readTeam();
  if (!canManageTeam(team, userId)) {
    throw new TeamStoreError('forbidden', 'Solo el propietario puede invitar miembros');
  }

  const email = normalizeEmail(input.email);
  if (!email.includes('@')) {
    throw new TeamStoreError('invalid_email', 'Correo electrónico inválido');
  }

  const owner = findOwner(team);
  if (owner && normalizeEmail(owner.email) === email) {
    throw new TeamStoreError('duplicate', 'El propietario ya forma parte del equipo');
  }

  if (team.members.some(m => normalizeEmail(m.email) === email)) {
    throw new TeamStoreError('duplicate', 'Este correo ya es miembro del equipo');
  }

  if (team.invites.some(i => normalizeEmail(i.email) === email)) {
    throw new TeamStoreError('duplicate', 'Ya existe una invitación pendiente para este correo');
  }

  const invite: TeamInviteRecord = {
    id: randomUUID(),
    email,
    role: input.role,
    invitedAt: new Date().toISOString(),
    invitedByUserId: userId,
  };
  team.invites.push(invite);
  await writeTeam(team);
  return getTeamResponse(userId);
}

export async function updateTeamMemberRole(
  memberId: string,
  role: TeamRole,
  userId?: string,
): Promise<TeamResponse> {
  const team = await readTeam();
  if (!canManageTeam(team, userId)) {
    throw new TeamStoreError('forbidden', 'Solo el propietario puede cambiar roles');
  }

  const index = team.members.findIndex(m => m.id === memberId);
  if (index < 0) {
    throw new TeamStoreError('not_found', 'Miembro no encontrado');
  }

  const member = team.members[index];
  if (member.role === 'owner') {
    throw new TeamStoreError('forbidden', 'No se puede cambiar el rol del propietario');
  }

  if (role === 'owner') {
    throw new TeamStoreError('forbidden', 'No se puede asignar el rol de propietario');
  }

  team.members[index] = { ...member, role };
  await writeTeam(team);
  return getTeamResponse(userId);
}

export async function removeTeamMember(memberId: string, userId?: string): Promise<TeamResponse> {
  const team = await readTeam();
  if (!canManageTeam(team, userId)) {
    throw new TeamStoreError('forbidden', 'Solo el propietario puede eliminar miembros');
  }

  const member = team.members.find(m => m.id === memberId);
  if (!member) {
    throw new TeamStoreError('not_found', 'Miembro no encontrado');
  }
  if (member.role === 'owner') {
    throw new TeamStoreError('forbidden', 'No se puede eliminar al propietario');
  }

  team.members = team.members.filter(m => m.id !== memberId);
  await writeTeam(team);
  return getTeamResponse(userId);
}

export async function revokeTeamInvite(inviteId: string, userId?: string): Promise<TeamResponse> {
  const team = await readTeam();
  if (!canManageTeam(team, userId)) {
    throw new TeamStoreError('forbidden', 'Solo el propietario puede revocar invitaciones');
  }

  const before = team.invites.length;
  team.invites = team.invites.filter(i => i.id !== inviteId);
  if (team.invites.length === before) {
    throw new TeamStoreError('not_found', 'Invitación no encontrada');
  }

  await writeTeam(team);
  return getTeamResponse(userId);
}

export class TeamStoreError extends Error {
  constructor(
    readonly code: 'forbidden' | 'not_found' | 'duplicate' | 'invalid_email',
    message: string,
  ) {
    super(message);
    this.name = 'TeamStoreError';
  }
}
