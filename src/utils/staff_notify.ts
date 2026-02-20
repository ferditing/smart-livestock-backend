import crypto from "crypto";
import { sendSMS } from "./sms_service";
import { smsTemplates } from "./sms_templates";
import { sendStaffInviteEmail } from "./email_service";

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// =============================
// Generate temporary password
// =============================
export function generateTempPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let pwd = "";
  for (let i = 0; i < 10; i++) {
    pwd += chars[crypto.randomInt(0, chars.length)];
  }
  return pwd;
}

/** Generate a one-time token for set-password link (64 chars hex) */
export function generateSetPasswordToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

// =============================
// Notify staff credentials
// =============================
export async function notifyStaffCredentials(params: {
  name: string;
  email: string;
  phone?: string | null;
  tempPassword: string;
  role: string;
  /** If provided, link will use token so user can set password without typing temp password */
  setPasswordToken?: string;
}): Promise<{ smsOk?: boolean; emailOk?: boolean }> {
  const setPasswordUrl = params.setPasswordToken
    ? `${FRONTEND_URL}/set-password?token=${params.setPasswordToken}`
    : `${FRONTEND_URL}/set-password`;
  const result: { smsOk?: boolean; emailOk?: boolean } = {};

  // If there is no email, include the temp password in SMS
  const includeTempInSms = !params.email;
  const smsParams: { name: string; setPasswordUrl: string; role: string; tempPassword?: string } = {
    name: params.name,
    setPasswordUrl,
    role: params.role,
  };
  if (includeTempInSms) smsParams.tempPassword = params.tempPassword;

  const smsBody = smsTemplates.staffInviteSms({
    ...smsParams,
    setPasswordUrl,
  });

  // SEND EMAIL (include token URL so user can set password via link)
  const emailParams = { ...params, setPasswordUrl };

  // SEND SMS
  if (params.phone && params.phone.trim()) {
    try {
      await sendSMS(params.phone, smsBody);
      result.smsOk = true;
    } catch (err) {
      console.error("[StaffNotify] SMS failed:", err);
    }
  }

  // SEND EMAIL
  if (params.email) {
    const fullBody = smsTemplates.staffInvite(emailParams);

    try {
      await sendStaffInviteEmail({
        name: params.name,
        email: params.email,
        fullBody,
        role: params.role,
      });
      result.emailOk = true;
    } catch (err) {
      console.error("[StaffNotify] Email failed:", err);
    }
  }

  return result;
}
