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