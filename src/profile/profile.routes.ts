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
      "created_at",
      "assigned_county"
    )
    .where({ id: req.user.id })
    .first();

    res.json(user);
});

// Update current user's profile (subadmin cannot change county/assigned_county)
router.put("/me", authMiddleware, async(req: AuthRequest, res) => {
    const { profile_meta, latitude, longitude, county, sub_county, ward, locality, phone, name } = req.body;
    const isSubadmin = req.user?.role === 'subadmin';

    const updateData: any = {};
    if (phone !== undefined) updateData.phone = phone;
    if (name !== undefined && String(name).trim()) updateData.name = String(name).trim();
    if (!isSubadmin) {
      if (latitude !== undefined) updateData.latitude = latitude;
      if (longitude !== undefined) updateData.longitude = longitude;
      if (county !== undefined) updateData.county = county;
      if (sub_county !== undefined) updateData.sub_county = sub_county;
      if (ward !== undefined) updateData.ward = ward;
      if (locality !== undefined) updateData.locality = locality;
    }

    let mergedMeta = profile_meta || {};
    if (!isSubadmin && (county !== undefined || sub_county !== undefined || ward !== undefined || locality !== undefined)) {
      mergedMeta = {
        ...mergedMeta,
        ...(county !== undefined && { county }),
        ...(sub_county !== undefined && { subcounty: sub_county }),
        ...(ward !== undefined && { ward }),
        ...(locality !== undefined && { locality })
      };
    }
    updateData.profile_meta = mergedMeta;

    if (!isSubadmin && latitude !== undefined && longitude !== undefined && latitude !== null && longitude !== null) {
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
