export interface MemberDocument {
  id: string;
  member_id: string;
  document_type: 'medical_clearance' | 'waiver' | 'fitness_assessment' | 'id_proof' | 'other';
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  description: string | null;
  expires_at: string | null;
  uploaded_at: string;
}

export interface CreateDocumentPayload {
  document_type: string;
  file_url: string;
  file_name?: string;
  file_size?: number;
  description?: string;
  expires_at?: string;
}

export interface UpdateDocumentPayload {
  document_type?: string;
  description?: string;
  expires_at?: string | null;
}
