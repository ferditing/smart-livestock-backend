import { Router } from "express";
import db from "../db";
import { authMiddleware, AuthRequest } from "../middleware/auth.middleware";



const router = Router();

// Get current user's profile
router.get("/me", authMiddleware, async(req: AuthRequest, res) => {
    const user = await db("users")
    .select(
      "id", 
      "name", 
      "email", 
      "role", 
      "phone",
      "profile_meta", 
      "latitude",
      "longitude",
      "county",
      "sub_county",
      "ward",
      "locality",
      "created_at"
    )
    .where({ id: req.user.id })
    .first();

    res.json(user);
});

// Update current user's profile
router.put("/me", authMiddleware, async(req: AuthRequest, res) => {
    const { profile_meta, latitude, longitude, county, sub_county, ward, locality, phone } = req.body;

    const updateData: any = {};
    
    // Update phone if provided
    if (phone !== undefined) updateData.phone = phone;
    
    // Update location fields from request body
    if (latitude !== undefined) updateData.latitude = latitude;
    if (longitude !== undefined) updateData.longitude = longitude;
    if (county !== undefined) updateData.county = county;
    if (sub_county !== undefined) updateData.sub_county = sub_county;
    if (ward !== undefined) updateData.ward = ward;
    if (locality !== undefined) updateData.locality = locality;

    // If profile_meta is provided, merge location fields into it for consistency
    let mergedMeta = profile_meta || {};
    if (county !== undefined || sub_county !== undefined || ward !== undefined || locality !== undefined) {
      mergedMeta = {
        ...mergedMeta,
        ...(county !== undefined && { county }),
        ...(sub_county !== undefined && { subcounty: sub_county }),
        ...(ward !== undefined && { ward }),
        ...(locality !== undefined && { locality })
      };
    }
    updateData.profile_meta = mergedMeta;

    // Update location_point if coordinates provided
    if (latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
      updateData.location_point = db.raw(
        "ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography",
        [longitude, latitude]
      );
    }

    await db("users")
     .where({ id: req.user.id }) 
     .update(updateData);

    res.json({ success : true});
});

export default router;
