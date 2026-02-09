import { Router } from "express";
import db from "../db";
import { sendSMS } from "../utils/sms_service";
import { smsTemplates } from "../utils/sms_templates";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

/**
 * FARMER: Request appointment
 */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  const { report_id, provider_id, scheduled_at } = req.body;

  const [ins] = await db("appointments")
    .insert({
      report_id,
      provider_id,
      farmer_id: req.user.id,
      scheduled_at,
      status: "pending",
    })
    .returning(["id", "status"]);

  //  Fetch vet + farmer details for SMS
  const vet = await db("providers")
    .where("providers.id", provider_id)
    .leftJoin("users", "providers.user_id", "users.id")
    .select("users.phone", "users.name")
    .first();

  const farmer = await db("users")
    .where("id", req.user.id)
    .select(
      "name",
      "phone",
      "latitude",
      "longitude",
      // Prefer table columns (locality, ward, sub_county, county). Fallback only to profile_meta keys with same names.
      db.raw("COALESCE(locality, profile_meta->>'locality') as locality"),
      db.raw("COALESCE(ward, profile_meta->>'ward') as ward"),
      db.raw("COALESCE(sub_county, profile_meta->>'sub_county') as sub_county"),
      db.raw("COALESCE(county, profile_meta->>'county') as county")
    )
    .first();

  //  Send SMS (async, don't block response)
  if (vet?.phone) {
    const locality = farmer.locality || "";
    const ward = farmer.ward || "";
    const subCounty = farmer.sub_county || "";
    const county = farmer.county || "";

    // Build location string
    const locationStr = [locality, ward, subCounty, county]
      .filter(Boolean)
      .join(", ") || "Not specified";

    // Generate Google Maps link if coordinates available
    let mapLink = "";
    if (farmer.latitude && farmer.longitude) {
      mapLink = `\nhttps://maps.google.com/?q=${farmer.latitude},${farmer.longitude}`;
    }

    const message = `Vet Appointment Request
Farmer: ${farmer.name}
Phone: ${farmer.phone || "N/A"}
Date: ${scheduled_at}
Location: ${locationStr}${mapLink}`;

    sendSMS(vet.phone, message)
      .then(() => console.log(`[SMS] Sent to vet ${vet.name} (${vet.phone})`))
      .catch((err) => console.error(`[SMS] Failed to send to ${vet.phone}:`, err.message));
  } else {
    console.warn(`[SMS] Vet ${vet?.name} has no phone number on file`);
  }

  res.status(201).json(ins);
});

/**
 * ROLE-BASED: List appointments
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (req.user.role === "farmer") {
    const appointments = await db("appointments")
      .where("farmer_id", req.user.id)
      .leftJoin("users as farmer", "appointments.farmer_id", "farmer.id")
      .leftJoin("providers", "appointments.provider_id", "providers.id")
      .leftJoin("users as vet", "providers.user_id", "vet.id")
      .select(
        "appointments.id",
        "appointments.report_id",
        "appointments.provider_id",
        "appointments.farmer_id",
        "appointments.scheduled_at",
        "appointments.status",
        "appointments.created_at",
        "farmer.name as farmer_name",
        "farmer.phone as farmer_phone",
        "farmer.county as farmer_county",
        "farmer.sub_county as farmer_sub_county",
        "farmer.ward as farmer_ward",
        "farmer.locality as farmer_locality",
        "vet.id as vet_id",
        "vet.name as vet_name",
        "vet.phone as vet_phone",
        "vet.county as vet_county",
        "vet.sub_county as vet_sub_county",
        "vet.ward as vet_ward",
        "vet.locality as vet_locality"
      );
    return res.json(appointments);
  }

  if (req.user.role === "vet") {
    const provider = await db("providers")
      .where("user_id", req.user.id)
      .first();
    if (!provider) return res.json([]);
    
    const appointments = await db("appointments")
      .where("provider_id", provider.id)
      .leftJoin("users as farmer", "appointments.farmer_id", "farmer.id")
      .leftJoin("providers", "appointments.provider_id", "providers.id")
      .leftJoin("users as vet", "providers.user_id", "vet.id")
      .select(
        "appointments.id",
        "appointments.report_id",
        "appointments.provider_id",
        "appointments.farmer_id",
        "appointments.scheduled_at",
        "appointments.status",
        "appointments.created_at",
        "farmer.name as farmer_name",
        "farmer.phone as farmer_phone",
        "farmer.county as farmer_county",
        "farmer.sub_county as farmer_sub_county",
        "farmer.ward as farmer_ward",
        "farmer.locality as farmer_locality",
        "vet.id as vet_id",
        "vet.name as vet_name",
        "vet.phone as vet_phone",
        "vet.county as vet_county",
        "vet.sub_county as vet_sub_county",
        "vet.ward as vet_ward",
        "vet.locality as vet_locality"
      );
    return res.json(appointments);
  }

  const appointments = await db("appointments")
    .leftJoin("users as farmer", "appointments.farmer_id", "farmer.id")
    .leftJoin("providers", "appointments.provider_id", "providers.id")
    .leftJoin("users as vet", "providers.user_id", "vet.id")
    .select(
      "appointments.id",
      "appointments.report_id",
      "appointments.provider_id",
      "appointments.farmer_id",
      "appointments.scheduled_at",
      "appointments.status",
      "appointments.created_at",
      "farmer.name as farmer_name",
      "farmer.phone as farmer_phone",
      "farmer.county as farmer_county",
      "farmer.sub_county as farmer_sub_county",
      "farmer.ward as farmer_ward",
      "farmer.locality as farmer_locality",
      "vet.id as vet_id",
      "vet.name as vet_name",
      "vet.phone as vet_phone",
      "vet.county as vet_county",
      "vet.sub_county as vet_sub_county",
      "vet.ward as vet_ward",
      "vet.locality as vet_locality"
    );
  res.json(appointments);
});

/**
 * VET: Assigned appointments (dashboard)
 */
router.get("/assigned", authMiddleware, async (req: AuthRequest, res) => {
  if (req.user.role !== "vet")
    return res.status(403).json({ error: "vets only" });

  const provider = await db("providers")
    .where("user_id", req.user.id)
    .first();

  if (!provider) return res.json([]);

  const appointments = await db("appointments")
    .where("provider_id", provider.id)
    .leftJoin("users as farmer", "appointments.farmer_id", "farmer.id")
    .leftJoin("providers", "appointments.provider_id", "providers.id")
    .leftJoin("users as vet", "providers.user_id", "vet.id")
    .select(
      "appointments.id",
      "appointments.report_id",
      "appointments.provider_id",
      "appointments.farmer_id",
      "appointments.scheduled_at",
      "appointments.status",
      "appointments.created_at",
      "farmer.name as farmer_name",
      "farmer.phone as farmer_phone",
      "farmer.county as farmer_county",
      "farmer.sub_county as farmer_sub_county",
      "farmer.ward as farmer_ward",
      "farmer.locality as farmer_locality",
      "vet.id as vet_id",
      "vet.name as vet_name",
      "vet.phone as vet_phone",
      "vet.county as vet_county",
      "vet.sub_county as vet_sub_county",
      "vet.ward as vet_ward",
      "vet.locality as vet_locality"
    );

  res.json(appointments);
});

// My diagnoses
router.get("/diagnoses", authMiddleware, async (req: AuthRequest, res) => {
  const diagnoses = await db("diagnoses")
  .join("symptom_reports", "diagnoses.report_id", "symptom_reports.id")
  .where("symptom_reports.user_id", req.user.id)
  .select("diagnoses.*");

  res.json(diagnoses);
});

/**
 * Update appointment (status change)
 * - vets can accept/decline appointments assigned to their provider record
 * - farmers can cancel their own appointments
 * - sends SMS to farmer on accept/decline
 */
router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;

  if (!status) return res.status(400).json({ error: "status required" });

  // allowed statuses (expand as needed)
  const allowed = ["pending", "accepted", "declined", "cancelled", "completed"];
  if (!allowed.includes(status)) return res.status(400).json({ error: "invalid status" });

  const appt = await db("appointments").where("id", id).first();
  if (!appt) return res.status(404).json({ error: "not found" });

  // vets: must own the provider record
  if (req.user.role === "vet") {
    const provider = await db("providers").where("user_id", req.user.id).first();
    if (!provider || provider.id !== appt.provider_id) return res.status(403).json({ error: "forbidden" });
  }

  // farmers: must own appointment to change (e.g., cancel)
  if (req.user.role === "farmer") {
    if (appt.farmer_id !== req.user.id) return res.status(403).json({ error: "forbidden" });
  }

  const [updated] = await db("appointments").where("id", id).update({ status }).returning("*");

  // Send SMS to farmer if vet accepts/declines
  if ((status === "accepted" || status === "declined") && req.user.role === "vet") {
    try {
      const details = await db("appointments")
        .where("appointments.id", id)
        .join("users as farmer", "appointments.farmer_id", "farmer.id")
        .join("providers", "appointments.provider_id", "providers.id")
        .join("users as vet", "providers.user_id", "vet.id")
        .select(
          "farmer.phone as farmer_phone",
          "farmer.name as farmer_name",
          "vet.name as vet_name",
          "vet.phone as vet_phone",
          "vet.locality as vet_locality",
          "vet.ward as vet_ward",
          "vet.sub_county as vet_sub_county",
          "vet.county as vet_county",
          "vet.latitude as vet_latitude",
          "vet.longitude as vet_longitude",
          "appointments.scheduled_at"
        )
        .first();

      if (details?.farmer_phone) {
        const vetLocation = [
          details.vet_locality,
          details.vet_ward,
          details.vet_sub_county,
          details.vet_county,
        ]
          .filter(Boolean)
          .join(", ");

        let message = "";
        if (status === "accepted") {
          message = smsTemplates.vetAccepted({
            vetName: details.vet_name,
            vetPhone: details.vet_phone || "N/A",
            location: vetLocation || "Not specified",
            lat: details.vet_latitude,
            lng: details.vet_longitude,
            date: details.scheduled_at,
          });
        } else if (status === "declined") {
          message = smsTemplates.vetDeclined({
            vetName: details.vet_name,
            location: vetLocation || "Not specified",
            date: details.scheduled_at,
          });
        }

        if (message) {
          sendSMS(details.farmer_phone, message)
            .then(() =>
              console.log(
                `[SMS] Status update sent to farmer ${details.farmer_name} (${details.farmer_phone})`
              )
            )
            .catch((err) =>
              console.error(
                `[SMS] Failed to send status update to ${details.farmer_phone}:`,
                err.message
              )
            );
        }
      } else {
        console.warn(`[SMS] Farmer has no phone number on file for appointment ${id}`);
      }
    } catch (err) {
      console.error(`[SMS] Error sending status update SMS:`, err);
    }
  }

  res.json(updated);
});
export default router;