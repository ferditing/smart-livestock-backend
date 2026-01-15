import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './auth/auth.routes';
import reportsRoutes from './reports/reports.routes';
import providersRoutes from './providers/providers.routes';
import agroProductsRoutes from './agro/products.routes';
import appointmentsRoutes from './appointments/appointments.routes';
import feedbackRoutes from './feedback/feedback.routes';
import adminRoutes from './admin/admin.routes';
import mlRoutes from './ml/ml.routes';

const app = express();

// Enable CORS for frontend (adjust origin as needed)
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173' }));

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Support preflight for all routes
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// CORS preflight (FIXED)
app.options(/.*/, (_req, res) => {
  res.sendStatus(200);
});


app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/agro/products', agroProductsRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.send('Smart Livestock Backend up'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
