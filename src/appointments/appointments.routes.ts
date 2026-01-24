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

export default router;
