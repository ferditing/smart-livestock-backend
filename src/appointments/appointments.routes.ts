import { Router } from "express";
import db from "../db";
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

  res.status(201).json(ins);
});

/**
 * ROLE-BASED: List appointments
 */
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
  if (req.user.role === "farmer") {
    return res.json(
      await db("appointments").where("farmer_id", req.user.id)
    );
  }

  if (req.user.role === "vet") {
    const provider = await db("providers")
      .where("user_id", req.user.id)
      .first();
    if (!provider) return res.json([]);
    return res.json(
      await db("appointments").where("provider_id", provider.id)
    );
  }

  res.json(await db("appointments"));
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

  res.json(await db("appointments").where("provider_id", provider.id));
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

  const [updated] = await db("appointments").where("id", id).update({ status }).returning(["id", "status"]);

  res.json(updated);
});

export default router;
