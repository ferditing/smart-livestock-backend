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
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        county: location?.county || null,
        sub_county: location?.sub_county || null,
        ward: location?.ward || null,
        locality: location?.locality || null,
        location_point:
          location?.lat && location?.lng
            ? db.raw(
                "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography",
                [location.lng, location.lat]
              )
            : null,
        profile_meta: location
          ? {
              county: location.county,
              sub_county: location.sub_county,
              ward: location.ward,
              locality: location.locality,
            }
          : null,
      })
      .returning(["id", "name", "email", "role", "county", "sub_county", "ward", "locality"]);

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

    // Trim email and password to handle whitespace
    const trimmedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const trimmedPassword = typeof password === 'string' ? password.trim() : '';

    const user = await db("users").where({ email: trimmedEmail }).first();
    if (!user) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const ok = await bcrypt.compare(trimmedPassword, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "invalid credentials" });
    }

    const payload: { id: number; email: string; role: string; assigned_county?: string } = {
      id: user.id,
      email: user.email,
      role: user.role,
    };
    if (user.role === "subadmin" && user.assigned_county) {
      payload.assigned_county = user.assigned_county;
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });

    const userOut: { id: number; name: string; email: string; role: string; mustChangePassword?: boolean; assigned_county?: string } = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    if (user.must_change_password) userOut.mustChangePassword = true;
    if (user.role === "subadmin" && user.assigned_county) userOut.assigned_county = user.assigned_county;

    res.json({ token, user: userOut });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
}

/** Set password using one-time token (from staff invite email link). No auth required. */
export async function setPasswordWithToken(req: Request, res: Response) {
  try {
    const { token, newPassword } = req.body;
    const trimmedToken = typeof token === 'string' ? token.trim() : '';
    const trimmedNew = typeof newPassword === 'string' ? newPassword.trim() : '';

    if (!trimmedToken || !trimmedNew) {
      return res.status(400).json({ error: 'token and newPassword required' });
    }
    if (trimmedNew.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const user = await db('users')
      .where({ password_reset_token: trimmedToken })
      .whereNotNull('password_reset_token')
      .whereRaw('password_reset_expires_at > NOW()')
      .first();

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired link. Please ask your admin to resend the invitation.' });
    }

    const password_hash = await bcrypt.hash(trimmedNew, SALT_ROUNDS);
    await db('users').where({ id: user.id }).update({
      password_hash,
      must_change_password: false,
      password_reset_token: null,
      password_reset_expires_at: null,
    });

    res.json({ ok: true, message: 'Password set successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'server error' });
  }
}

export async function changePassword(req: Request, res: Response) {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const { currentPassword, newPassword } = req.body;
    // Trim passwords to handle any accidental whitespace
    const trimmedCurrent = typeof currentPassword === 'string' ? currentPassword.trim() : '';
    const trimmedNew = typeof newPassword === 'string' ? newPassword.trim() : '';
    
    if (!trimmedCurrent || !trimmedNew) {
      return res.status(400).json({ error: "currentPassword and newPassword required" });
    }
    if (trimmedNew.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const user = await db("users").where({ id: userId }).first();
    if (!user) return res.status(401).json({ error: "User not found" });

    const ok = await bcrypt.compare(trimmedCurrent, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Current password is incorrect" });

    const password_hash = await bcrypt.hash(trimmedNew, SALT_ROUNDS);
    await db("users").where({ id: userId }).update({
      password_hash,
      must_change_password: false,
      password_reset_token: null,
      password_reset_expires_at: null,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "server error" });
  }
}
