import { Router } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";
import { generateRegNo } from "../utils/generateRegno";

const router = Router();


router.get("/search", authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { reg_no } = req.query;
    

    if (!reg_no) {
      return res.status(400).json({ error: 'reg_no is required' });
    }

    const animal = await db('animals')
      .where({ reg_no: reg_no as string })
      .first();


    if (!animal) {
      return res.status(404).json({ error: 'Animal not found' });
    }

    res.json(animal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search animal' });
  }
});


router.post('/animals', authMiddleware, async (req, res) => {
  try {
    const { species, breed, age, weight, tag_id } = req.body;
    const userId = (req as any).user.id;

    const reg_no = await generateRegNo(species);

    const [animal] = await db('animals').insert({
      user_id: userId,
      species,
      breed,
      age,
      weight,
      tag_id,
      reg_no 
    }).returning('*');

    res.status(201).json(animal);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create animal' });
  }
});

// add animal
router.post("/", authMiddleware, async (req: AuthRequest, res) => {
    if (req.user.role !== "farmer"){
        return res.status(403).json({ error: "Forbidden, farmers only" });
    }

    const { species, breed, age, weight, tag_id } = req.body;

    const reg_no = await generateRegNo(species);
  

    const [animal] = await db("animals")
    .insert({
        user_id: req.user.id,
        species,
        breed,
        age,    
        weight,
        tag_id,
        reg_no
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

// inventory summary (must be before /:id)
router.get("/summary", authMiddleware, async (req: AuthRequest, res) => {
    const rows = await db("animals")
        .select("species")
        .count("* as count")
        .where("user_id", req.user.id)
        .groupBy("species");
    res.json(rows);
});

// get single animal
router.get("/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
        const { id } = req.params;
        const animal = await db("animals")
            .where({ id, user_id: req.user.id })
            .first();
        if (!animal) return res.status(404).json({ error: "Animal not found" });
        res.json(animal);
    } catch (e) {
        res.status(500).json({ error: "Failed to fetch animal" });
    }
});

// update animal
router.put("/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
        if (req.user.role !== "farmer") return res.status(403).json({ error: "Forbidden, farmers only" });
        const { id } = req.params;
        const { species, breed, age, weight, tag_id } = req.body;
        const updateData: Record<string, unknown> = {};
        if (species !== undefined) updateData.species = species;
        if (breed !== undefined) updateData.breed = breed;
        if (age !== undefined) updateData.age = age;
        if (weight !== undefined) updateData.weight = weight;
        if (tag_id !== undefined) updateData.tag_id = tag_id;

        const [updated] = await db("animals")
            .where({ id, user_id: req.user.id })
            .update(updateData)
            .returning("*");
        if (!updated) return res.status(404).json({ error: "Animal not found" });
        res.json(updated);
    } catch (e) {
        res.status(500).json({ error: "Failed to update animal" });
    }
});

// delete animal
router.delete("/:id", authMiddleware, async (req: AuthRequest, res) => {
    try {
        if (req.user.role !== "farmer") return res.status(403).json({ error: "Forbidden, farmers only" });
        const { id } = req.params;
        const deleted = await db("animals")
            .where({ id, user_id: req.user.id })
            .del();
        if (!deleted) return res.status(404).json({ error: "Animal not found" });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: "Failed to delete animal" });
    }
});

export default router;