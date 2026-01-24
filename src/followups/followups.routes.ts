import { Router } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

router.post("/" , authMiddleware, async(req: AuthRequest, res) => {
    if (req.user.role !== "vet")
        return res.status(403).json({error: "vets only"});

    const [f] = await db("follow_ups")
    .insert({...req.body, vet_id: req.user.id})
    .returning("*")

    res.json(f);
});

export default router;