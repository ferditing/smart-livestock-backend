export const smsTemplates = {

  vetAccepted: (data: {
    vetName: string;
    vetPhone: string;
    location: string;
    lat?: number;
    lng?: number;
    date: string;
  }) => {
    const mapLink =
      data.lat && data.lng
        ? `https://maps.google.com/?q=${data.lat},${data.lng}`
        : "";

    return `Appointment Confirmed ✅

Vet: ${data.vetName}
Phone: ${data.vetPhone}
Location: ${data.location}
Date: ${data.date}
${mapLink ? `Map: ${mapLink}` : ""}

Please arrive on time.`.trim();
  },

  staffInvite: (data: {
    name: string;
    email: string;
    tempPassword: string;
    setPasswordUrl: string;
    role: string;
  }) =>
    `SmartLivestock Staff Account

Hello ${data.name},

Your ${data.role} account has been created.
Email: ${data.email}
Temporary password: ${data.tempPassword}

Click this link to set your preferred password (you can use the link without typing the temporary password):
${data.setPasswordUrl}

Link expires in 48 hours.`.trim(),

  staffInviteSms: (data: { name: string; setPasswordUrl: string; role: string; tempPassword?: string }) =>
    data.tempPassword
      ? `SmartLivestock: Hi ${data.name}. ${data.role} acct. Temp pwd: ${data.tempPassword}. Login: ${data.setPasswordUrl} then set new pwd.`
      : `SmartLivestock: Hi ${data.name}. Your ${data.role} account is ready. Set password: ${data.setPasswordUrl} (exp 48h)`.trim(),

  vetDeclined: (data: {
    vetName: string;
    location: string;
    date: string;
  }) => `Appointment Update ❌

${data.vetName} from ${data.location}
has DECLINED your appointment
scheduled on ${data.date}

Please book another vet.`.trim(),
};
