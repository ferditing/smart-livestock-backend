import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

import authRoutes from './auth/auth.routes';
import reportsRoutes from './reports/reports.routes';
import providersRoutes from './providers/providers.routes';
import appointmentsRoutes from './appointments/appointments.routes';
import feedbackRoutes from './feedback/feedback.routes';
import adminRoutes from './admin/admin.routes';

const app = express();
app.use(express.json());
app.use('/uploads', express.static('uploads'));

app.use('/api/auth', authRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);

app.get('/', (req, res) => res.send('Smart Livestock Backend up'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server listening on ${port}`));
