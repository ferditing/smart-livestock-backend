import { Server as HTTPServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import db from '../db';

interface NotificationPayload {
  title: string;
  message: string;
  type: string;
  data?: any;
  action_url?: string;
}

class WebSocketService {
  private io: Server;
  private userSockets: Map<number, Set<string>> = new Map();

  constructor(httpServer: HTTPServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_ORIGIN
          ? process.env.FRONTEND_ORIGIN.split(',').map((o) => o.trim())
          : ['http://localhost:5173', 'http://localhost:5174'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  /**
   * Setup authentication middleware - verify JWT and extract userId
   */
  private setupMiddleware() {
    this.io.use((socket, next) => {
      const token = socket.handshake.auth?.token;
      const userId = socket.handshake.auth?.userId;

      if (!token) {
        return next(new Error('Authentication error: Missing token'));
      }

      try {
        const payload = jwt.verify(token, process.env.JWT_SECRET || 'default_secret') as { id?: number; userId?: number };
        const validatedUserId = Number(payload?.id ?? payload?.userId ?? userId ?? 0);
        if (!validatedUserId || isNaN(validatedUserId)) {
          return next(new Error('Authentication error: Invalid userId'));
        }
        socket.data.userId = validatedUserId;
        next();
      } catch (err) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  /**
   * Setup connection handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const userId = socket.data.userId;
      console.log(`✓ User ${userId} connected (${socket.id})`);

      // Track user sockets
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(socket.id);

      // Join user-specific room
      socket.join(`user:${userId}`);

      // Emit online status
      this.io.emit('user:online', {
        userId,
        socketId: socket.id,
        timestamp: new Date(),
      });

      socket.on('disconnect', () => {
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
            this.io.emit('user:offline', {
              userId,
              timestamp: new Date(),
            });
          }
        }
        console.log(`✗ User ${userId} disconnected`);
      });

      socket.on('notification:read', (notificationId: number) => {
        this.markNotificationAsRead(notificationId);
      });

      socket.on('ping', () => {
        socket.emit('pong');
      });
    });
  }

  /**
   * Send notification to specific user and persist to database
   */
  async notifyUser(userId: number, payload: NotificationPayload) {
    try {
      // Save to database (use returning for PostgreSQL)
      const [inserted] = await db('notifications')
        .insert({
          user_id: userId,
          type: payload.type,
          title: payload.title,
          message: payload.message,
          data: payload.data ? JSON.stringify(payload.data) : null,
          action_url: payload.action_url,
          read: false,
        })
        .returning('*');

      const notificationId = inserted?.id;

      // Send via WebSocket - use 'notification:new' to match frontend
      this.io.to(`user:${userId}`).emit('notification:new', {
        ...payload,
        id: notificationId,
        read: false,
        created_at: inserted?.created_at || new Date().toISOString(),
        updated_at: inserted?.updated_at || new Date().toISOString(),
      });

      return notificationId;
    } catch (error) {
      console.error(`Error notifying user ${userId}:`, error);
    }
  }

  /**
   * Send notification to multiple users
   */
  async notifyUsers(userIds: number[], payload: NotificationPayload) {
    for (const userId of userIds) {
      await this.notifyUser(userId, payload);
    }
  }

  /**
   * Broadcast to all connected users
   */
  async broadcast(payload: NotificationPayload) {
    this.io.emit('notification', {
      ...payload,
      timestamp: new Date(),
    });
  }

  /**
   * Mark notification as read
   */
  private async markNotificationAsRead(notificationId: number) {
    try {
      await db('notifications')
        .where('id', notificationId)
        .update({
          read: true,
          updated_at: new Date(),
        });

      console.log(`Notification ${notificationId} marked as read`);
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  /**
   * Get active user count
   */
  getActiveUsers(): number {
    return this.userSockets.size;
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): Server {
    return this.io;
  }
}

export default WebSocketService;
