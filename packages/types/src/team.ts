/**
 * Team entity types
 */

import { z } from 'zod';
import { TimestampedEntitySchema } from './database';

/** Team permissions enum schema */
export const TeamPermissionSchema = z.enum([
  'manage_members',
  'manage_sites',
  'manage_plugins',
  'manage_billing',
  'view_analytics',
  'manage_settings',
]);

export type TeamPermission = z.infer<typeof TeamPermissionSchema>;

/** Team role enum schema */
export const TeamRoleTypeSchema = z.enum(['owner', 'admin', 'member', 'viewer']);

/** Team invitation status enum schema */
export const TeamInviteStatusSchema = z.enum(['pending', 'accepted', 'declined', 'expired']);

/** Team entity schema */
export const TeamSchema = TimestampedEntitySchema.extend({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  owner_id: z.string().uuid(),
  owner_email: z.string().email().optional(),
  logo_url: z.string().url().optional(),
  website: z.string().url().optional(),
  member_count: z.number().int().nonnegative().optional(),
});

export type Team = z.infer<typeof TeamSchema>;

/** Create team form schema */
export const CreateTeamFormSchema = z.object({
  name: z.string().min(1, "Team naam is verplicht").max(100, "Naam mag maximaal 100 tekens zijn"),
  description: z.string().max(500, "Beschrijving mag maximaal 500 tekens zijn").optional(),
});

export type CreateTeamForm = z.infer<typeof CreateTeamFormSchema>;

/** Team invite form schema */
export const TeamInviteFormSchema = z.object({
  email: z.string().email("Voer een geldig e-mailadres in"),
  team_role_id: z.string().min(1, "Selecteer een rol"),
});

export type TeamInviteForm = z.infer<typeof TeamInviteFormSchema>;

/** Team role entity schema */
export const TeamRoleSchema = TimestampedEntitySchema.extend({
  team_id: z.string().uuid(),
  user_id: z.string().uuid(),
  user_email: z.string().email().optional(),
  role: TeamRoleTypeSchema,
  permissions: z.array(TeamPermissionSchema).optional(),
});

export type TeamRole = z.infer<typeof TeamRoleSchema>;

/** Team invitation entity schema */
export const TeamInviteSchema = TimestampedEntitySchema.extend({
  team_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
  invited_by: z.string().uuid(),
  status: TeamInviteStatusSchema,
  expires_at: z.string().datetime().optional(),
});

export type TeamInvite = z.infer<typeof TeamInviteSchema>;

/** Data for creating a new team schema */
export const CreateTeamInputSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  owner_id: z.string().uuid(),
});

export type CreateTeamInput = z.infer<typeof CreateTeamInputSchema>;

/** Data for inviting a team member schema */
export const InviteTeamMemberInputSchema = z.object({
  team_id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']),
});

export type InviteTeamMemberInput = z.infer<typeof InviteTeamMemberInputSchema>;
