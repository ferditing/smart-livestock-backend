/**
 * Optional email service for staff invitations.
 * Install nodemailer and set SMTP env vars
 * (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)
 * to enable sending.
 */

type SendParams = {
  name: string;
  email: string;
  fullBody: string;
  role: string;
};

export async function sendStaffInviteEmail(params: SendParams): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Email disabled if env not configured
  if (!host || !user || !pass) {
    console.warn("[Email] SMTP not configured — skipping email send");
    return;
  }

  try {
    const nodemailerModule = await import("nodemailer").catch(() => null);

    if (!nodemailerModule || !("default" in nodemailerModule)) {
      console.warn("[Email] nodemailer not installed or invalid — skipping");
      return;
    }

    const nodemailer = (nodemailerModule as any).default;

    const transporter = nodemailer.createTransport({
      host,
      port: Number(port) || 587,
      secure: port === "465",
      auth: {
        user,
        pass,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || `SmartLivestock <${user}>`,
      to: params.email,
      subject: `SmartLivestock ${params.role} Account - Set Your Password`,
      text: params.fullBody,
    });

  } catch (err) {
    console.error("[Email] sendStaffInviteEmail failed:", err);
    throw err;
  }
}
