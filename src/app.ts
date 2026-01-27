import express from 'express';
import clinicalRoutes from './routes/clinical.routes';

const app = express();

// Register routes
app.use('/api/v1', clinicalRoutes);

export default app;