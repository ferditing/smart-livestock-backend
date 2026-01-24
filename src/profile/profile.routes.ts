import { Router } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";



const router = Router();

// Get current user's profile
router.get("/me", authMiddleware, async(req: AuthRequest, res) => {
    const user = await db("users")
    .select("id", "name", "email", "role", "profile_meta", "created_at")
    .where({ id: req.user.id })
    .first();

    res.json(user);
});

// Update current user's profile
router.put("/me", authMiddleware, async(req: AuthRequest, res) => {
    const {profile_meta } = req.body;

    await db("users")
     .where({ id: req.user.id }) 
     .update({ profile_meta });

    res.json({ success : true});
});

export default router;
