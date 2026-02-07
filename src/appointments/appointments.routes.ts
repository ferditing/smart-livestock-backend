import { Router } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

/**
 * FARMER: Request appointment
 */
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { report_id, provider_id, scheduled_at, farmer_lat, farmer_lng } = req.body;

    const insertData: any = {
      report_id,
      provider_id,
      farmer_id: req.user.id,
      scheduled_at,
      status: "pending",
    };

    // Store farmer location if provided
    if (farmer_lat && farmer_lng) {
      insertData.farmer_location = db.raw(
        'ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography',
        [parseFloat(farmer_lng), parseFloat(farmer_lat)]
      );
    }

    const [ins] = await db("appointments")
      .insert(insertData)
      .returning(["id", "status"]);

    res.status(201).json(ins);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

/**
 * ROLE-BASED: List appointments
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role === "farmer") {
      const appointments = await db("appointments as a")
        .leftJoin("users as u", "a.farmer_id", "u.id")
        .leftJoin("providers as p", "a.provider_id", "p.id")
        .where("a.farmer_id", req.user.id)
        .select(
          "a.*",
          db.raw("u.name as farmer_name"),
          db.raw("u.phone as farmer_phone"),
          db.raw("u.email as farmer_email"),
          db.raw("u.profile_meta as farmer_location"),
          db.raw("ST_Y(a.farmer_location::geometry) as farmer_lat"),
          db.raw("ST_X(a.farmer_location::geometry) as farmer_lng"),
          db.raw("p.name as provider_name")
        );
      return res.json(appointments);
    }

    if (req.user.role === "vet") {
      // First try to get appointments via provider record
      const provider = await db("providers")
        .where("user_id", req.user.id)
        .first();

      if (provider) {
        const appointments = await db("appointments as a")
          .leftJoin("users as u", "a.farmer_id", "u.id")
          .leftJoin("providers as p", "a.provider_id", "p.id")
          .where("a.provider_id", provider.id)
          .select(
            "a.*",
            db.raw("u.name as farmer_name"),
            db.raw("u.phone as farmer_phone"),
            db.raw("u.email as farmer_email"),
            db.raw("u.profile_meta as farmer_location"),
            db.raw("ST_Y(a.farmer_location::geometry) as farmer_lat"),
            db.raw("ST_X(a.farmer_location::geometry) as farmer_lng"),
            db.raw("p.name as provider_name")
          );
        return res.json(appointments);
      } else {
        // If vet doesn't have provider record yet, create one
        const [newProvider] = await db("providers")
          .insert({
            user_id: req.user.id,
            name: req.user.name,
            provider_type: "vet",
          })
          .returning("id");

        return res.json([]);
      }
    }

    // Admin/other roles - get all appointments
    const appointments = await db("appointments as a")
      .leftJoin("users as u", "a.farmer_id", "u.id")
      .leftJoin("providers as p", "a.provider_id", "p.id")
      .select(
        "a.*",
        db.raw("u.name as farmer_name"),
        db.raw("u.phone as farmer_phone"),
        db.raw("u.email as farmer_email"),
        db.raw("u.profile_meta as farmer_location"),
        db.raw("p.name as provider_name")
      );
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

/**
 * VET: Assigned appointments (dashboard)
 */
router.get("/assigned", authMiddleware, async (req: AuthRequest, res) => {
  try {
    if (req.user.role !== "vet")
      return res.status(403).json({ error: "vets only" });

    const provider = await db("providers")
      .where("user_id", req.user.id)
      .first();

    if (!provider) {
      // Auto-create provider if doesn't exist
      const [newProvider] = await db("providers")
        .insert({
          user_id: req.user.id,
          name: req.user.name,
          provider_type: "vet",
        })
        .returning("id");
      return res.json([]);
    }

    const appointments = await db("appointments as a")
      .leftJoin("users as u", "a.farmer_id", "u.id")
      .leftJoin("providers as p", "a.provider_id", "p.id")
      .where("a.provider_id", provider.id)
      .select(
        "a.*",
        db.raw("u.name as farmer_name"),
        db.raw("u.phone as farmer_phone"),
        db.raw("u.email as farmer_email"),
        db.raw("u.profile_meta as farmer_location"),
        db.raw("ST_Y(a.farmer_location::geometry) as farmer_lat"),
        db.raw("ST_X(a.farmer_location::geometry) as farmer_lng"),
        db.raw("p.name as provider_name")
      );
    
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
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
 */
router.patch("/:id", authMiddleware, async (req: AuthRequest, res) => {
  try {
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
      let provider = await db("providers").where("user_id", req.user.id).first();
      
      // Auto-create provider if doesn't exist
      if (!provider) {
        const [newProvider] = await db("providers")
          .insert({
            user_id: req.user.id,
            name: req.user.name,
            provider_type: "vet",
          })
          .returning(["id"]);
        provider = { id: newProvider };
      }
      
      if (provider.id !== appt.provider_id) return res.status(403).json({ error: "forbidden" });
    }

    // farmers: must own appointment to change (e.g., cancel)
    if (req.user.role === "farmer") {
      if (appt.farmer_id !== req.user.id) return res.status(403).json({ error: "forbidden" });
    }

    const [updated] = await db("appointments").where("id", id).update({ status }).returning(["id", "status"]);

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update appointment" });
  }
});

export default router;
