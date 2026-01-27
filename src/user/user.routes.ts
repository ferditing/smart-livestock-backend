import express from 'express';
import db from '../db';
import { authMiddleware } from '../middleware/auth.middleware';

const router = express.Router();

// GET /api/users?role=vet
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role } = req.query;
    
    let query = db('users').select('id', 'name', 'email', 'role');
    
    if (role) {
      query = query.where({ role: role as string });
    }
    
    const users = await query;
    res.json(users);
  } catch (error) {
    console.error('Failed to fetch users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;