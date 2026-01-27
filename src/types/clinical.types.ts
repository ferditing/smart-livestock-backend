export interface CreateClinicalRecordDTO {
  animalId: string;
  vetId: string;
  diseaseId?: string;
  mlDiagnosis: string;
  mlConfidence: number;
  vetDiagnosis?: string;
  notes?: string;
}

export interface UpdateClinicalRecordDTO {
  vetDiagnosis?: string;
  status?: 'pending' | 'under_treatment' | 'recovered' | 'deceased';
  notes?: string;
}

export interface CreateFollowUpDTO {
  clinicalRecordId: string;
  scheduledDate: Date;
  notes?: string;
}

export interface ClinicalRecordResponse {
  id: string;
  animal: {
    id: string;
    name: string;
    type: string;
    breed: string;
  };
  vet: {
    id: string;
    name: string;
    email: string;
  };
  disease?: {
    id: string;
    name: string;
  };
  mlDiagnosis: string;
  mlConfidence: number;
  vetDiagnosis?: string;
  status: string;
  notes?: string;
  followUps: FollowUpResponse[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FollowUpResponse {
  id: string;
  scheduledDate: Date;
  completedDate?: Date;
  notes?: string;
  status: string;
}