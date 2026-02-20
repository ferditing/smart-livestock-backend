import express from 'express';
import cors from 'cors';
import path from "path";
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './auth/auth.routes';
import reportsRoutes from './reports/reports.routes';
import providersRoutes from './providers/providers.routes';
import agroProductsRoutes from './agro/products.routes';
import agroStatsRoutes from './agro/stats.routes';
import agroShopsRoutes from './agro/shops.routes';
import cartRoutes from './agro/cart.routes';
import ordersRoutes from './agro/orders.routes';
import appointmentsRoutes from './appointments/appointments.routes';
import feedbackRoutes from './feedback/feedback.routes';
import adminRoutes from './admin/admin.routes';
import subadminRoutes from './admin/subadmin.routes';
import applicationsRoutes from './applications/applications.routes';
import mlRoutes from './ml/ml.routes';
import profileRoutes from './profile/profile.routes';
import followupsRoutes from './followups/followups.routes';
import animalRoutes from './animal/animal.routes';
import userRoutes from './user/user.routes';
import clinicalRoutes from './routes/clinical.routes';
import publicRoutes from './routes/public.routes';

const app = express();

// Enable CORS for frontend (support 5173, 5174 when port changes)
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173', 'http://127.0.0.1:5174'];
app.use(cors({ origin: allowedOrigins, credentials: true }));

app.use(express.json());
app.use('/uploads', express.static('uploads'));
app.use(
  "/uploads",
  express.static(path.join(__dirname, "../uploads"))
);
// Support preflight for all routes
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// CORS preflight (FIXED)
app.options(/.*/, (_req, res) => {
  res.sendStatus(200);
});


app.use('/api', publicRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/agro/products', agroProductsRoutes);
app.use('/api/agro/stats', agroStatsRoutes);
app.use('/api/agro/shops', agroShopsRoutes);
app.use('/api/agro/cart', cartRoutes);
app.use('/api/agro/orders', ordersRoutes);
app.use('/api/ml', mlRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/subadmin', subadminRoutes);
app.use('/api/applications', applicationsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/animal', animalRoutes);
app.use('/api/followups', followupsRoutes);
app.use('/api/users', userRoutes);
app.use('/api', clinicalRoutes); 

app.get('/', (req, res) => res.send('Smart Livestock Backend up'));

//const port = process.env.PORT || 3000;
//app.listen(port, () => console.log(`Server listening on ${port}`));
const port = process.env.PORT || 3000;
const env = process.env.NODE_ENV || "development";

app.listen(port, () => {
  console.log(`[INFO] Server listening on http://localhost:${port}`);
  console.log(`[INFO] Environment: ${env}`);
  console.log(""); // optional blank line for cleaner terminal
})
