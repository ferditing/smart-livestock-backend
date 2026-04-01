import { Response } from 'express';
import db from '../db';
import type { AuthRequest } from '../middleware/auth.middleware';

export class NotificationController {
  /**
   * Get user notifications
   */
  static async getNotifications(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const { limit = 20, offset = 0, read } = req.query;

      let query = db('notifications').where('user_id', userId).orderBy('created_at', 'desc');

      if (read !== undefined) {
        query = query.where('read', read === 'true');
      }

      const total = await query.clone().count('* as count').first();
      const notifications = await query.limit(parseInt(limit as string)).offset(parseInt(offset as string));

      res.json({
        data: notifications,
        pagination: {
          total: total?.count || 0,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get unread notification count
   */
  static async getUnreadCount(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;
      const result = await db('notifications')
        .where('user_id', userId)
        .where('read', false)
        .count('* as count')
        .first();

      res.json({
        unreadCount: result?.count || 0,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Mark notification as read
   */
  static async markAsRead(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const notification = await db('notifications')
        .where('id', id)
        .where('user_id', userId)
        .first();

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      await db('notifications').where('id', id).update({
        read: true,
        updated_at: new Date(),
      });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Mark all notifications as read
   */
  static async markAllAsRead(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      await db('notifications')
        .where('user_id', userId)
        .where('read', false)
        .update({
          read: true,
          updated_at: new Date(),
        });

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete notification
   */
  static async deleteNotification(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      const userId = req.user?.id;

      const notification = await db('notifications')
        .where('id', id)
        .where('user_id', userId)
        .first();

      if (!notification) {
        return res.status(404).json({ error: 'Notification not found' });
      }

      await db('notifications').where('id', id).delete();

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Clear all notifications
   */
  static async clearAll(req: AuthRequest, res: Response) {
    try {
      const userId = req.user?.id;

      await db('notifications').where('user_id', userId).delete();

      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
}
