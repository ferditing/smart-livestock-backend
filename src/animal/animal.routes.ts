import { Router } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// add animal
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
    if (req.user.role !== "farmer"){
        return res.status(403).json({ error: "Forbidden, farmers only" });
    }

    const { species, breed, age, weight, tag_id } = req.body;

    const [animal] = await db("animals")
    .insert({
        user_id: req.user.id,
        species,
        breed,
        age,    
        weight,
        tag_id
    })
    .returning("*");

    res.status(201).json(animal);
});

// get all animals for farmer
router.get("/", authMiddleware, async (req: AuthRequest, res) => {
    const animals = await db("animals")
        .where("user_id", req.user.id);
    res.json(animals);
});


//  Inventory summary 
router.get("/summary", authMiddleware, async (req: AuthRequest, res) => {
    const rows = await db("animals")
        .select("species")
        .count("* as count")
        .where("user_id", req.user.id)
        .groupBy("species");

    res.json(rows);
})
export default router;