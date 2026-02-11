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
  try {
    const response = await axios.post(
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
    console.log("[SMS] Umesikia API Response:", response.data);
    return response;
  } catch (err: any) {
    console.error("[SMS] Umesikia API Error:", {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
};

const sendWithBlessed = async (phones: string[], message: string) => {
  try {
    const payload = {
      api_key: process.env.BLESSED_API_KEY,
      sender_id: process.env.BLESSED_SENDER_ID,
      message,
      phone: phones.join(","),
    };
    
    console.log("[SMS] Blessed Texts Payload:", JSON.stringify(payload, null, 2));
    
    const response = await axios.post(
      process.env.BLESSED_ENDPOINT!,
      payload,
      { headers: { "Content-Type": "application/json" }, timeout: 15000 }
    );
    
    console.log("[SMS] Blessed Texts API Response:", JSON.stringify(response.data, null, 2));
    
    // Check if API response indicates success
    if (Array.isArray(response.data)) {
      const results = response.data as any[];
      results.forEach(r => {
        if (r.status_code === '1000') {
          console.log(`[SMS] ✓ Message queued for delivery: ${r.phone} (ID: ${r.message_id})`);
        } else {
          console.warn(`[SMS] ⚠ API returned non-success code: ${r.status_code} - ${r.status_desc}`);
        }
      });
    }
    
    return response;
  } catch (err: any) {
    console.error("[SMS] Blessed Texts API Error:", {
      status: err.response?.status,
      statusText: err.response?.statusText,
      data: err.response?.data,
      message: err.message,
    });
    throw err;
  }
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
