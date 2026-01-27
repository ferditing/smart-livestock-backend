import express, { Router } from 'express';
import { clinicalController } from '../controllers/clinical.controller';
import { authMiddleware } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';

const router: Router = express.Router();

// Apply auth middleware to all routes
router.use(authMiddleware);

// Clinical Records
router.post(
  '/clinical-records',
  validateRequest('createClinicalRecord'),
  clinicalController.createClinicalRecord
);

router.get(
  '/clinical-records',
  clinicalController.getAllClinicalRecords
);

router.get(
  '/clinical-records/:recordId',
  clinicalController.getClinicalRecord
);

router.get(
  '/animals/:animalId/clinical-records',
  clinicalController.getAnimalClinicalHistory
);

router.put(
  '/clinical-records/:recordId',
  validateRequest('updateClinicalRecord'),
  clinicalController.updateClinicalRecord
);

// Follow-ups
router.post(
  '/clinical-records/:recordId/follow-ups',
  validateRequest('createFollowUp'),
  clinicalController.createFollowUp
);

router.put(
  '/follow-ups/:followUpId',
  validateRequest('updateFollowUp'),
  clinicalController.updateFollowUp
);

router.get(
  '/follow-ups/pending',
  clinicalController.getPendingFollowUps
);

export default router;