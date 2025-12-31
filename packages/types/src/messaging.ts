/**
 * Messaging and notification types
 */

import { z } from 'zod';
import { TimestampedEntitySchema, NotificationTypeSchema } from './database';

/** Message type enum schema */
export const MessageTypeSchema = z.enum(['message', 'site_transfer_request', 'system']);

/** Message reply structure schema */
export const MessageReplySchema = z.object({
  message: z.string().min(1),
  sender_email: z.string().email(),
  sender_id: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
});

export type MessageReply = z.infer<typeof MessageReplySchema>;

/** Message entity schema */
export const MessageSchema = TimestampedEntitySchema.extend({
  subject: z.string().min(1).max(200),
  message: z.string().min(1),
  sender_id: z.string().uuid(),
  sender_email: z.string().email(),
  recipient_id: z.string().uuid().optional(),
  recipient_email: z.string().email().optional(),
  is_read: z.boolean().optional(),
  replies: z.array(MessageReplySchema).optional(),
  metadata: z.record(z.any()).optional(),
  type: MessageTypeSchema.optional(),
});

export type Message = z.infer<typeof MessageSchema>;

/** Notification reply structure schema */
export const NotificationReplySchema = z.object({
  message: z.string().min(1),
  sender_email: z.string().email(),
  timestamp: z.string().datetime(),
});

export type NotificationReply = z.infer<typeof NotificationReplySchema>;

/** Notification entity schema */
export const NotificationSchema = TimestampedEntitySchema.extend({
  recipient_id: z.string().uuid(),
  recipient_email: z.string().email(),
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  type: NotificationTypeSchema,
  is_read: z.boolean(),
  replies: z.array(NotificationReplySchema).optional(),
  action_url: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export type Notification = z.infer<typeof NotificationSchema>;

/** Data for creating a message schema */
export const CreateMessageInputSchema = z.object({
  subject: z.string().min(1).max(200),
  message: z.string().min(1),
  sender_id: z.string().uuid(),
  sender_email: z.string().email(),
  recipient_id: z.string().uuid().optional(),
  recipient_email: z.string().email().optional(),
  type: MessageTypeSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateMessageInput = z.infer<typeof CreateMessageInputSchema>;

/** Data for creating a notification schema */
export const CreateNotificationInputSchema = z.object({
  recipient_id: z.string().uuid(),
  recipient_email: z.string().email(),
  title: z.string().min(1).max(200),
  message: z.string().min(1),
  type: NotificationTypeSchema,
  action_url: z.string().url().optional(),
  metadata: z.record(z.any()).optional(),
});

export type CreateNotificationInput = z.infer<typeof CreateNotificationInputSchema>;
