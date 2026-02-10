// backend/src/utils/sms_service.ts

import axios from "axios";

const normalizePhone = (phone: string): string | null => {
  let p = phone.replace(/[^\d+]/g, "");

  if (p.startsWith("+254")) return p.substring(1);
  if (p.startsWith("254")) return p;
  if (p.startsWith("0")) return "254" + p.substring(1);
  if (/^[17]\d{8}$/.test(p)) return "254" + p;

  return null;
};

const sendWithUmesikia = async (phones: string[], message: string) => {
  return axios.post(
    process.env.UMESIKIA_ENDPOINT!,
    new URLSearchParams({
      api_key: process.env.UMESIKIA_API_KEY!,
      app_id: process.env.UMESIKIA_APP_ID!,
      sender_id: process.env.UMESIKIA_SENDER_ID!,
      message,
      phone: phones.join(","),
    }),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
};

const sendWithBlessed = async (phones: string[], message: string) => {
  return axios.post(
    process.env.BLESSED_ENDPOINT!,
    {
      api_key: process.env.BLESSED_API_KEY,
      sender_id: process.env.BLESSED_SENDER_ID,
      message,
      phone: phones.join(","),
    },
    { headers: { "Content-Type": "application/json" } }
  );
};

export const sendSMS = async (
  recipients: string | string[],
  message: string
) => {
  const phones = (Array.isArray(recipients) ? recipients : [recipients])
    .map(normalizePhone)
    .filter(Boolean) as string[];

  if (!phones.length) {
    console.error("[SMS] No valid phone numbers after normalization");
    throw new Error("No valid phone numbers");
  }

  const primary = process.env.SMS_PRIMARY_PROVIDER || "blessed_texts";
  const failover = process.env.SMS_ENABLE_FAILOVER === "true";

  console.log(`[SMS] Sending to ${phones.join(", ")} via ${primary}`);

  try {
    if (primary === "blessed_texts")
      return await sendWithBlessed(phones, message);
    else
      return await sendWithUmesikia(phones, message);
  } catch (err) {
    console.error("[SMS] Primary provider failed:", err);
    if (!failover) throw err;

    // failover attempt
    console.log("[SMS] Attempting failover...");
    if (primary === "blessed_texts")
      return await sendWithUmesikia(phones, message);
    else
      return await sendWithBlessed(phones, message);
  }
};
