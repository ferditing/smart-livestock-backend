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
      const { animal_id, symptom_text, lat, lng, animal_type, canonical_symptoms: provided_canonical } = req.body;
      console.log('[REPORTS POST] Received report with:', { animal_type, provided_canonical, symptom_text: symptom_text?.substring(0, 50) });
      const imageFiles =
        ((req as any).files as Express.Multer.File[]) || [];
      const imagePaths = imageFiles.map((f) => f.filename);

      let canonical_animal = null;
      let canonical_symptoms: string[] = [];

      // If frontend provided canonical_symptoms (from ML prediction), normalize different shapes into string[]
      if (provided_canonical) {
        // possible shapes:
        // - ['symptom_a', 'symptom_b']
        // - { matched_symptoms: ['a','b'], confidence: 100 }
        // - [{ matched_symptoms: [...] }, ...]
        try {
          if (Array.isArray(provided_canonical)) {
            // flatten array items which may themselves be wrapper objects
            const flat: string[] = [];
            provided_canonical.forEach((item: any) => {
              if (!item) return;
              if (typeof item === 'string') flat.push(item);
              else if (Array.isArray(item.matched_symptoms)) flat.push(...item.matched_symptoms.map(String));
              else if (Array.isArray(item)) flat.push(...item.map(String));
              else if (typeof item === 'object') {
                // object with keys
                Object.values(item).forEach((v: any) => {
                  if (Array.isArray(v)) flat.push(...v.map(String));
                });
              }
            });
            canonical_symptoms = Array.from(new Set(flat));
          } else if (typeof provided_canonical === 'object' && Array.isArray((provided_canonical as any).matched_symptoms)) {
            canonical_symptoms = (provided_canonical as any).matched_symptoms.map(String);
          } else if (typeof provided_canonical === 'string') {
            canonical_symptoms = [String(provided_canonical)];
          }
          if (canonical_symptoms.length > 0) console.log('[REPORTS] Using provided canonical_symptoms (normalized):', canonical_symptoms);
        } catch (e) {
          console.warn('[REPORTS] Failed to normalize provided_canonical:', e);
        }

        // prefer provided animal_type if present
        if (animal_type) canonical_animal = String(animal_type).toLowerCase();
      } else {
        // Call ML service to normalize animal type and extract symptoms when symptom_text exists
        if (symptom_text) {
          try {
            const mlServiceUrl = process.env.ML_SERVICE_URL || 'http://localhost:8001';
            console.log(`[REPORTS] Calling ML normalize at: ${mlServiceUrl}/normalize`);
            const mlRes = await axios.post(
              `${mlServiceUrl}/normalize`,
              {
                animal: animal_type || "",
                symptom_text: symptom_text,
              },
              { timeout: 5000 }
            );
            console.log("[REPORTS] ML normalize response:", mlRes.data);
            canonical_animal = mlRes.data.animal_type;
            canonical_symptoms = mlRes.data.matched_symptoms || [];
          } catch (mlErr) {
            console.warn("[REPORTS] ML normalization failed:", (mlErr as Error)?.message || String(mlErr));
            console.warn("[REPORTS] Stack:", (mlErr as Error)?.stack);
            if (animal_type) {
              canonical_animal = animal_type.toLowerCase();
            }
          }
        }
      }

      // Ensure we have valid data to store
      console.log("[REPORTS] Storing report with animal_type:", canonical_animal, "symptoms:", canonical_symptoms);
      
      const [report] = await db("symptom_reports")
        .insert({
          user_id: req.user.id,
          animal_id: animal_id || null,
          symptom_text,
          animal_type: canonical_animal || null,
          canonical_symptoms: canonical_symptoms.length > 0 ? db.raw("ARRAY[?]::text[]", [canonical_symptoms]) : null,
          status: "received",
          images: imagePaths.length > 0 ? db.raw("ARRAY[?]::text[]", [imagePaths]) : null,
          location: db.raw(
            "ST_SetSRID(ST_MakePoint(?,?)::geometry,4326)::geography",
            [parseFloat(lng), parseFloat(lat)]
          ),
        })
        .returning(["id", "created_at", "animal_type", "canonical_symptoms"]);

      console.log("[REPORTS] Report created:", report);
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

  const rows = await db("symptom_reports as sr")
    .select(
      "sr.id",
      "sr.user_id",
      "sr.animal_id",
      "sr.animal_type",
      "sr.canonical_symptoms",
      "sr.symptom_text",
      "sr.status",
      "sr.created_at",
      "sr.images",
      "u.name as farmer_name"
    )
    .join("users as u", "sr.user_id", "u.id")
    .where("sr.status", "received")
    .orderBy("sr.created_at", "desc");

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
    `${process.env.ML_SERVICE_URL || 'http://localhost:8001'}/predict`,
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
