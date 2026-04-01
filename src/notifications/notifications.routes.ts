import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { NotificationController } from './notifications.controller';

const router = express.Router();

/**
 * All routes require authentication
 */
router.use(authMiddleware);

/**
 * Get notifications
 */
router.get('/', NotificationController.getNotifications);

/**
 * Get unread count (must be before /:id)
 */
router.get('/unread/count', NotificationController.getUnreadCount);

/**
 * Mark all as read (must be before /:id/read)
 */
router.patch('/read/all', NotificationController.markAllAsRead);

/**
 * Mark single notification as read
 */
router.patch('/:id/read', NotificationController.markAsRead);

/**
 * Delete notification
 */
router.delete('/:id', NotificationController.deleteNotification);

/**
 * Clear all notifications
 */
router.delete('/', NotificationController.clearAll);

export default router;
