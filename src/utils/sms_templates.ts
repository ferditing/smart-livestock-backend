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
