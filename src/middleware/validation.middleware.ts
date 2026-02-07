// validation.middleware — created by fix
import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

/**
 * Define request validation schemas keyed by name used across the routes.
 * Extend these validators as needed to match your controller expectations.
 */
const schemas: Record<string, Array<ReturnType<typeof body | typeof param>>> = {
  createClinicalRecord: [
    body('animalId').exists().withMessage('animalId is required').isNumeric().withMessage('animalId must be numeric'),
    body('vetId').exists().withMessage('Attending veterinarian is required').isNumeric().withMessage('vetId must be numeric'),
    body('mlDiagnosis').exists().withMessage('mlDiagnosis is required').isString().withMessage('mlDiagnosis must be a string'),
    body('mlConfidence').optional().isNumeric().withMessage('mlConfidence must be numeric'),
    body('vetDiagnosis').optional({ nullable: true }).isString().withMessage('vetDiagnosis must be a string'),
    body('notes').optional({ nullable: true }).isString().withMessage('notes must be a string'),
  ],
  updateClinicalRecord: [
    param('recordId').exists().withMessage('recordId is required').isString(),
    body('date').optional().isISO8601().withMessage('date must be ISO8601'),
    body('notes').optional().isString(),
  ],
  createFollowUp: [
    param('recordId').exists().withMessage('recordId is required').isString(),
    body('date').optional().isISO8601().withMessage('date must be ISO8601'),
    body('notes').optional().isString(),
  ],
  updateFollowUp: [
    param('followUpId').exists().withMessage('followUpId is required').isString(),
    body('date').optional().isISO8601().withMessage('date must be ISO8601'),
    body('notes').optional().isString(),
  ],
};

/**
 * Returns an Express middleware that runs the selected validation schema and
 * returns 400 with errors if validation fails.
 */
export function validateRequest(schemaName: string) {
  const validators = schemas[schemaName] || [];

  return async (req: Request, res: Response, next: NextFunction) => {
    // run each validator
    for (const validator of validators) {
      // each validator has a .run(req) method per express-validator API
      // @ts-ignore - run exists on returned validators
      await validator.run(req);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    return next();
  };
}