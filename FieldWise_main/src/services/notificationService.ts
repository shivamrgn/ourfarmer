/**
 * FieldWise — Real-time Agricultural Notification Service
 * Manages user notifications with persistent storage per user and real-time event dispatching.
 */

export interface AppNotification {
  id: string;
  userId: string | number;
  title: string;
  message: string;
  type: 'welcome' | 'alert' | 'advisory' | 'system';
  actionModule?: string;
  actionLabel?: string;
  createdAt: string;
  read: boolean;
}

const NOTIFICATION_EVENT = 'fieldwise:notifications_updated';

class NotificationService {
  private getStorageKey(userId: string | number): string {
    return `fieldwise_notifications_${userId}`;
  }

  /**
   * Get all notifications for a specific user
   */
  getUserNotifications(userId: string | number): AppNotification[] {
    if (!userId) return [];
    try {
      const raw = localStorage.getItem(this.getStorageKey(userId));
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /**
   * Save notifications for a user and dispatch an update event
   */
  private saveUserNotifications(userId: string | number, notifications: AppNotification[]): void {
    if (!userId) return;
    try {
      localStorage.setItem(this.getStorageKey(userId), JSON.stringify(notifications));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(NOTIFICATION_EVENT, { detail: { userId } }));
      }
    } catch (e) {
      console.error('Failed to save notifications:', e);
    }
  }

  /**
   * Create realistic welcome and onboarding notifications when a real user creates an account
   */
  createRegistrationNotifications(user: { id?: string | number; name?: string; full_name?: string; email?: string }): AppNotification[] {
    const userId = user.id || user.email || 'user_default';
    const displayName = user.name || user.full_name || (user.email ? user.email.split('@')[0] : 'Farmer');

    const now = new Date();
    const welcomeNotifications: AppNotification[] = [
      {
        id: `notif_welcome_${Date.now()}_1`,
        userId,
        title: `Welcome to Crops Wild, ${displayName}! 🌾`,
        message: `Your agricultural intelligence account has been created successfully. Set up your farm location and soil metrics in My Farm to receive AI crop predictions.`,
        type: 'welcome',
        actionModule: 'profile',
        actionLabel: 'Complete My Farm',
        createdAt: now.toISOString(),
        read: false,
      },
      {
        id: `notif_weather_${Date.now()}_2`,
        userId,
        title: `Live Agro-Weather Tracking Active 🌦️`,
        message: `Hyperlocal meteorological sync, rainfall forecasting, and heat stress monitoring are now running for your fields.`,
        type: 'alert',
        actionModule: 'weather',
        actionLabel: 'Check Weather',
        createdAt: new Date(now.getTime() - 2 * 60 * 1000).toISOString(),
        read: false,
      },
      {
        id: `notif_ai_${Date.now()}_3`,
        userId,
        title: `AI Agronomy Models Ready 🧪`,
        message: `ICAR-aligned crop suitability algorithms and soil NPK fertilizer advisors are primed for your farm records.`,
        type: 'advisory',
        actionModule: 'crop-recommendation',
        actionLabel: 'Explore Recommendations',
        createdAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
        read: false,
      },
    ];

    // Store notifications
    this.saveUserNotifications(userId, welcomeNotifications);
    return welcomeNotifications;
  }

  /**
   * Ensure user has notifications; if none exist (e.g. for existing demo user), initializes default ones
   */
  ensureUserNotifications(user: { id?: string | number; name?: string; full_name?: string; email?: string }): AppNotification[] {
    const userId = user.id || user.email || 'user_default';
    const existing = this.getUserNotifications(userId);
    if (existing.length > 0) {
      return existing;
    }
    return this.createRegistrationNotifications(user);
  }

  /**
   * Add a single new notification for a user
   */
  addNotification(
    userId: string | number,
    data: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'userId'>
  ): AppNotification {
    const current = this.getUserNotifications(userId);
    const newNotif: AppNotification = {
      ...data,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId,
      createdAt: new Date().toISOString(),
      read: false,
    };
    const updated = [newNotif, ...current];
    this.saveUserNotifications(userId, updated);
    return newNotif;
  }

  /**
   * Mark a single notification as read
   */
  markAsRead(userId: string | number, notifId: string): void {
    const current = this.getUserNotifications(userId);
    const updated = current.map((n) => (n.id === notifId ? { ...n, read: true } : n));
    this.saveUserNotifications(userId, updated);
  }

  /**
   * Mark all notifications as read for a user
   */
  markAllAsRead(userId: string | number): void {
    const current = this.getUserNotifications(userId);
    const updated = current.map((n) => ({ ...n, read: true }));
    this.saveUserNotifications(userId, updated);
  }

  /**
   * Clear all notifications for a user
   */
  clearAll(userId: string | number): void {
    this.saveUserNotifications(userId, []);
  }

  /**
   * Get unread count
   */
  getUnreadCount(userId: string | number): number {
    return this.getUserNotifications(userId).filter((n) => !n.read).length;
  }
}

export const notificationService = new NotificationService();
export { NOTIFICATION_EVENT };
