import { Router } from "express";
import multer from "multer";
import type { Express } from "express";
import axios from "axios";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const upload = multer({ dest: "uploads/" });
const router = Router();

/**
 * FARMER: Create symptom report
 */
router.post(
  "/",
  authMiddleware,
  upload.array("images", 5),
  async (req: AuthRequest, res) => {
    try {
      const { animal_id, symptom_text, lat, lng } = req.body;
      const imageFiles =
        ((req as any).files as Express.Multer.File[]) || [];
      const imagePaths = imageFiles.map((f) => f.filename);

      const [report] = await db("symptom_reports")
        .insert({
          user_id: req.user.id,
          animal_id: animal_id || null,
          symptom_text,
          images: db.raw("ARRAY[?]::text[]", [imagePaths]),
          location: db.raw(
            "ST_SetSRID(ST_MakePoint(?,?)::geometry,4326)::geography",
            [parseFloat(lng), parseFloat(lat)]
          ),
        })
        .returning(["id", "created_at"]);

      res.status(201).json({ report_id: report.id, status: "received" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "server error" });
    }
  }
);

/**
 * FARMER: List own reports
 */
router.get("/my", authMiddleware, async (req: AuthRequest, res) => {
  if (req.user.role !== "farmer")
    return res.status(403).json({ error: "farmers only" });

  const rows = await db("symptom_reports")
    .where("user_id", req.user.id)
    .orderBy("created_at", "desc");

  res.json(rows);
});

/**
 * VET: Incoming cases
 */
router.get("/incoming", authMiddleware, async (req: AuthRequest, res) => {
  if (req.user.role !== "vet")
    return res.status(403).json({ error: "vets only" });

  const rows = await db("symptom_reports")
    .where("status", "received")
    .orderBy("created_at", "asc");

  res.json(rows);
});

/**
 * VET: Diagnose case (calls ML service)
 */
router.post("/:id/diagnose", authMiddleware, async (req: AuthRequest, res) => {
  if (req.user.role !== "vet")
    return res.status(403).json({ error: "vets only" });

  const reportId = Number(req.params.id);

  const ml = await axios.post(
    `${process.env.ML_SERVICE_URL}/predict`,
    req.body
  );

  const [diag] = await db("diagnoses")
    .insert({
      report_id: reportId,
      predicted_label: ml.data.predicted_label,
      confidence: ml.data.confidence,
    })
    .returning("*");

  await db("symptom_reports")
    .where("id", reportId)
    .update({ status: "diagnosed" });

  res.json(diag);
});

/**
 * VET: Resolve case
 */
router.post("/:id/resolve", authMiddleware, async (req: AuthRequest, res) => {
  if (req.user.role !== "vet")
    return res.status(403).json({ error: "vets only" });

  await db("symptom_reports")
    .where("id", req.params.id)
    .update({ status: "resolved" });

  res.json({ status: "resolved" });
});

/**
 * SHARED: Get report + latest diagnosis
 */
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);

  const report = await db("symptom_reports").where("id", id).first();
  if (!report) return res.status(404).json({ error: "not found" });

  if (req.user.role === "farmer" && report.user_id !== req.user.id)
    return res.status(403).json({ error: "forbidden" });

  const diagnosis = await db("diagnoses")
    .where("report_id", id)
    .orderBy("created_at", "desc")
    .first();

  res.json({ report, diagnosis });
});

export default router;
