import { Request, Response } from "express";
import db from "../db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "default_secret";
const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS || 10);

export async function register(req: Request, res: Response) {
  try {
    const { name, email, phone, password, role, location } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, password required" });
    }

    const existing = await db("users").where({ email }).first();
    if (existing) {
      return res.status(409).json({ error: "email already exists" });
    }

    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    const [user] = await db("users")
      .insert({
        name,
        email,
        phone,
        password_hash,
        role,
        profile_meta: location
          ? {
              county: location.county,
              sub_county: location.sub_county,
              locality: location.locality,
            }
          : null,
      })
      .returning(["id", "name", "email", "role"]);

    // 🔥 AUTO-CREATE PROVIDER FOR VET / AGROVET
    if (role === "vet" || role === "agrovet") {
      await db("providers").insert({
        user_id: user.id,
        name,
        provider_type: role,
        location:
          location?.lat && location?.lng
            ? db.raw(
                "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography",
                [location.lng, location.lat]
              )
            : null,
      });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.status(201).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password required" });
    }

    const user = await db("users").where({ email }).first();
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
}
