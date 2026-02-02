import { Request, Response } from 'express';
import db from '../db';
import { CreateClinicalRecordDTO, UpdateClinicalRecordDTO, CreateFollowUpDTO } from '../types/clinical.types';

export const clinicalController = {
  
  createClinicalRecord: async (req: Request, res: Response) => {
    try {

      const { animalId, vetId, mlDiagnosis, mlConfidence, vetDiagnosis, notes } = req.body;

      const user = (req as any).user;

      const finalVetId = user.role === 'vet' ? user.id : req.body.vetId;

      if (!finalVetId) {
      return res.status(400).json({ error: 'Attending vet ID is required' });
      }



      // Verify animal exists
      const animal = await db('animals').where({ id: animalId }).first();

      if (!animal) {
        return res.status(404).json({ error: 'Animal not found' });
      }

      // Create clinical record
      const [record] = await db('clinical_records').insert({
        animal_id: animalId,
        vet_id: finalVetId,
        ml_diagnosis: mlDiagnosis,
        ml_confidence: mlConfidence,
        vet_diagnosis: vetDiagnosis,
        notes,
        status: 'pending'
      }).returning('*');

      // Fetch the created record with joins
      const clinicalRecord = await db('clinical_records as cr')
        .where('cr.id', record.id)
        .leftJoin('animals as a', 'cr.animal_id', 'a.id')
        .leftJoin('users as v', 'cr.vet_id', 'v.id')
        .select(
          'cr.*',
          db.raw('json_build_object(\'id\', a.id, \'name\', a.species, \'type\', a.species, \'breed\', a.breed, \'tag_id\', a.tag_id) as animal'),
          db.raw('json_build_object(\'id\', v.id, \'name\', v.name, \'email\', v.email) as vet')
        )
        .first();

      res.status(201).json(clinicalRecord);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create clinical record' });
    }
  },

  getClinicalRecord: async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;

      const clinicalRecord = await db('clinical_records as cr')
        .where('cr.id', recordId)
        .leftJoin('animals as a', 'cr.animal_id', 'a.id')
        .leftJoin('users as v', 'cr.vet_id', 'v.id')
        .select(
          'cr.*',
          db.raw('json_build_object(\'id\', a.id, \'name\', a.species, \'type\', a.species, \'breed\', a.breed, \'reg_no\', a.reg_no) as animal'),
          db.raw('json_build_object(\'id\', v.id, \'name\', v.name, \'email\', v.email) as vet')
        )
        .first();

      if (!clinicalRecord) {
        return res.status(404).json({ error: 'Clinical record not found' });
      }

     
      clinicalRecord.followUps = [];

      res.json(clinicalRecord);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clinical record' });
    }
  },

  getAllClinicalRecords: async (req: Request, res: Response) => {
    try {
      const user = (req as any).user;

      const { id: userId, role } = (req as any).user;

      let query = db('clinical_records as cr')
        .leftJoin('animals as a', 'cr.animal_id', 'a.id')
        .leftJoin('users as v', 'cr.vet_id', 'v.id');


      if (role === 'vet') {
        query = query.where('cr.vet_id', Number(userId));
      } else if (role === 'farmer') {
        query = query.where('a.user_id', Number(userId));
      }

      const clinicalRecords = await query
        .select(
          'cr.*',
          db.raw('json_build_object(\'id\', a.id, \'name\', a.species, \'type\', a.species, \'breed\', a.breed) as animal'),
          db.raw('json_build_object(\'id\', v.id, \'name\', v.name, \'email\', v.email) as vet')
        )
        .orderBy('cr.created_at', 'desc');

      res.json(clinicalRecords);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clinical records' });
    }
  },
  

  getAnimalClinicalHistory: async (req: Request, res: Response) => {
    try {
      const { animalId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const clinicalRecords = await db('clinical_records as cr')
        .where('cr.animal_id', animalId)
        .leftJoin('animals as a', 'cr.animal_id', 'a.id')
        .leftJoin('users as v', 'cr.vet_id', 'v.id')
        .select(
          'cr.*',
          db.raw('json_build_object(\'id\', a.id, \'name\', a.name, \'type\', a.species, \'breed\', a.breed) as animal'),
          db.raw('json_build_object(\'id\', v.id, \'name\', v.name, \'email\', v.email) as vet')
        )
        .orderBy('cr.created_at', 'desc')
        .limit(parseInt(limit as string))
        .offset(parseInt(offset as string));

      const countResult = await db('clinical_records')
        .where({ animal_id: animalId })
        .count('* as count');

      const count = countResult[0]?.count ?? 0;

      res.json({
        data: clinicalRecords,
        total: parseInt(count as string),
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch clinical history' });
    }
  },

  updateClinicalRecord: async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      const { vetDiagnosis, status, notes }: UpdateClinicalRecordDTO = req.body;

      const updateData: any = {};
      if (vetDiagnosis) updateData.vet_diagnosis = vetDiagnosis;
      if (status) updateData.status = status;
      if (notes) updateData.notes = notes;

      await db('clinical_records')
        .where({ id: recordId })
        .update(updateData);

      // Fetch updated record
      const clinicalRecord = await db('clinical_records as cr')
        .where('cr.id', recordId)
        .leftJoin('animals as a', 'cr.animal_id', 'a.id')
        .leftJoin('users as v', 'cr.vet_id', 'v.id')
        .select(
          'cr.*',
          db.raw('json_build_object(\'id\', a.id, \'name\', a.name, \'type\', a.species, \'breed\', a.breed) as animal'),
          db.raw('json_build_object(\'id\', v.id, \'name\', v.name, \'email\', v.email) as vet')
        )
        .first();

      res.json(clinicalRecord);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update clinical record' });
    }
  },

  createFollowUp: async (req: Request, res: Response) => {
    try {
      const { recordId } = req.params;
      const { scheduledDate, notes }: CreateFollowUpDTO = req.body;

      // Verify clinical record exists
      const clinicalRecord = await db('clinical_records').where({ id: recordId }).first();

      if (!clinicalRecord) {
        return res.status(404).json({ error: 'Clinical record not found' });
      }

      const [followUp] = await db('follow_ups').insert({
        clinical_record_id: recordId,
        scheduled_date: new Date(scheduledDate),
        notes,
        status: 'pending'
      }).returning('*');

      res.status(201).json(followUp);
    } catch (error) {
      res.status(500).json({ error: 'Failed to create follow-up' });
    }
  },

  updateFollowUp: async (req: Request, res: Response) => {
    try {
      const { followUpId } = req.params;
      const { completedDate, notes, status } = req.body;

      const updateData: any = {};
      if (completedDate) updateData.completed_date = new Date(completedDate);
      if (notes) updateData.notes = notes;
      if (status) updateData.status = status;

      const [followUp] = await db('follow_ups')
        .where({ id: followUpId })
        .update(updateData)
        .returning('*');

      res.json(followUp);
    } catch (error) {
      res.status(500).json({ error: 'Failed to update follow-up' });
    }
  },

  getPendingFollowUps: async (req: Request, res: Response) => {
    try {
      const { vetId } = req.query;

      let query = db('follow_ups as fu')
        .where('fu.status', 'pending')
        .join('clinical_records as cr', 'fu.clinical_record_id', 'cr.id')
        .leftJoin('animals as a', 'cr.animal_id', 'a.id')
        .leftJoin('users as v', 'cr.vet_id', 'v.id');

      if (vetId) {
        query = query.where('cr.vet_id', vetId as string);
      }

      const followUps = await query
        .select(
          'fu.*',
          db.raw('json_build_object(\'id\', cr.id, \'ml_diagnosis\', cr.ml_diagnosis, \'status\', cr.status) as clinical_record'),
          db.raw('json_build_object(\'id\', a.id, \'name\', a.name, \'type\', a.species) as animal'),
          db.raw('json_build_object(\'id\', v.id, \'name\', v.name) as vet')
        )
        .orderBy('fu.scheduled_date', 'asc');

      res.json(followUps);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch pending follow-ups' });
    }
  }
};