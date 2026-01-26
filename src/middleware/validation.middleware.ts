// validation.middleware — created by fix
import { Request, Response, NextFunction } from 'express';
import { body, param, validationResult } from 'express-validator';

/**
 * Define request validation schemas keyed by name used across the routes.
 * Extend these validators as needed to match your controller expectations.
 */
const schemas: Record<string, Array<ReturnType<typeof body | typeof param>>> = {
  createClinicalRecord: [
    body('animalId').exists().withMessage('animalId is required').isString(),
    body('date').optional().isISO8601().withMessage('date must be ISO8601'),
    body('notes').optional().isString(),
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