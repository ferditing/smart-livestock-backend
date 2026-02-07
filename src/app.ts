import express from 'express';
import clinicalRoutes from './routes/clinical.routes';
import animalRoutes from './animal/animal.routes';
import providersRoutes from './providers/providers.routes';
import appointmentsRoutes from './appointments/appointments.routes';

const app = express();

// Register routes
app.use('/api/v1', clinicalRoutes);
app.use('/api/animal', animalRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/appointments', appointmentsRoutes);

export default app;