/* ScholarAI — notification API client */

import * as api from "./api";

export interface Notification {
  _id: string;
  recipient_user_id: string;
  author_id: string | null;
  event_type: string;
  platform: string | null;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  message: string;
  paper_id: string | null;
  paper_title: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export const fetchNotifications = api.fetchNotifications as (limit?: number, unreadOnly?: boolean) => Promise<Notification[]>;
export const fetchUnreadCount = api.fetchUnreadCount;
export const markAsRead = api.markAsRead;
export const markAllAsRead = api.markAllAsRead;
export const fetchPreferences = api.fetchPreferences;
export const updatePreferences = api.updatePreferences;
