import { Request } from 'express';
import WebSocketService from '../services/websocket.service';

/**
 * Helper class to emit notifications from various controllers
 */
export class NotificationEvents {
  /**
   * Appointment booked notification
   */
  static async appointmentBooked(
    req: Request,
    farmerId: number,
    appointmentData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(farmerId, {
      type: 'appointment:booked',
      title: 'Appointment Confirmed',
      message: `Your appointment with ${appointmentData.provider_name} is confirmed for ${appointmentData.appointment_date}`,
      data: appointmentData,
      action_url: `/appointments/${appointmentData.id}`,
    });
  }

  /**
   * Appointment reminder notification
   */
  static async appointmentReminder(
    req: Request,
    farmerId: number,
    appointmentData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(farmerId, {
      type: 'appointment:reminder',
      title: 'Upcoming Appointment',
      message: `Reminder: You have an appointment in 24 hours with ${appointmentData.provider_name}`,
      data: appointmentData,
      action_url: `/appointments/${appointmentData.id}`,
    });
  }

  /**
   * Appointment cancelled notification
   */
  static async appointmentCancelled(
    req: Request,
    farmerId: number,
    appointmentData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(farmerId, {
      type: 'appointment:cancelled',
      title: 'Appointment Cancelled',
      message: `Your appointment on ${appointmentData.appointment_date} has been cancelled`,
      data: appointmentData,
      action_url: `/appointments`,
    });
  }

  /**
   * Order status changed notification
   */
  static async orderStatusChanged(
    req: Request,
    farmerId: number,
    orderData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    const statusMessages: Record<string, string> = {
      pending: 'Your order is pending approval',
      processing: 'Your order is being processed',
      ready: 'Your order is ready for pickup/delivery',
      completed: 'Your order has been completed',
      cancelled: 'Your order has been cancelled',
    };

    const orderId = orderData.orderId ?? orderData.id ?? orderData.orderNumber;
    await wsService.notifyUser(farmerId, {
      type: 'order:status',
      title: 'Order Status Update',
      message: `Order #${orderId}: ${statusMessages[orderData.status] || 'Status updated'}`,
      data: orderData,
      action_url: `/farmer/orders`,
    });
  }

  /**
   * Clinical report ready notification
   */
  static async clinicalReportReady(
    req: Request,
    farmerId: number,
    reportData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(farmerId, {
      type: 'clinical:report',
      title: 'Clinical Report Ready',
      message: `Your clinical report for ${reportData.animal_type} (${reportData.animal_name}) is ready for review`,
      data: reportData,
      action_url: `/animals/${reportData.animal_id}/clinical-records/${reportData.id}`,
    });
  }

  /**
   * Payment received notification
   */
  static async paymentReceived(
    req: Request,
    userId: number,
    paymentData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(userId, {
      type: 'payment:received',
      title: 'Payment Received',
      message: `Payment of KES ${paymentData.amount} has been received for ${paymentData.description}`,
      data: paymentData,
      action_url: `/orders/${paymentData.order_id || paymentData.invoice_id}`,
    });
  }

  /**
   * Product stock low notification (for providers)
   */
  static async productStockLow(
    req: Request,
    providerId: number,
    productData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(providerId, {
      type: 'product:stock_low',
      title: 'Low Stock Warning',
      message: `Product "${productData.name}" stock is running low (${productData.quantity} units remaining)`,
      data: productData,
      action_url: `/products/${productData.id}`,
    });
  }

  /**
   * New appointment request for provider
   */
  static async newAppointmentForProvider(
    req: Request,
    providerId: number,
    appointmentData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    const aptId = appointmentData.appointmentId ?? appointmentData.id;
    await wsService.notifyUser(providerId, {
      type: 'appointment:new_request',
      title: 'New Appointment Request',
      message: `New appointment request from ${appointmentData.farmer_name || appointmentData.farmerName} on ${appointmentData.scheduledAt || appointmentData.appointment_date}`,
      data: appointmentData,
      action_url: aptId ? `/vet/appointments` : `/vet`,
    });
  }

  /**
   * Admin notification
   */
  static async adminNotification(
    req: Request,
    adminId: number,
    notificationData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(adminId, {
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data,
      action_url: notificationData.action_url,
    });
  }

  /**
   * Generic notification for any type
   */
  static async notify(
    req: Request,
    userId: number,
    payload: { type: string; title: string; message: string; data?: any; action_url?: string }
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUser(userId, payload);
  }

  /**
   * Welcome notification for newly registered users
   */
  static async welcomeUser(
    req: Request,
    userId: number,
    userData: { name: string; role?: string | null }
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    const safeName = userData.name || 'there';
    const roleSegment =
      userData.role && typeof userData.role === 'string'
        ? ` (${userData.role.toString().toUpperCase()})`
        : '';

    await wsService.notifyUser(userId, {
      type: 'system:welcome',
      title: 'Welcome to SmartLivestock',
      message: `Welcome ${safeName}${roleSegment} to the SmartLivestock Management System.`,
      data: {
        name: userData.name,
        role: userData.role,
      },
      action_url: userData.role ? `/${userData.role}` : '/',
    });
  }

  /**
   * Send to multiple users
   */
  static async notifyMultiple(
    req: Request,
    userIds: number[],
    notificationData: any
  ) {
    const wsService = req.app.locals.wsService as WebSocketService;
    if (!wsService) return;

    await wsService.notifyUsers(userIds, {
      type: notificationData.type,
      title: notificationData.title,
      message: notificationData.message,
      data: notificationData.data,
      action_url: notificationData.action_url,
    });
  }
}
