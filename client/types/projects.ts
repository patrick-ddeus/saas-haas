export interface Project {
  id: string;
  title: string;
  description?: string;
  client_name: string;
  client_id?: string;
  organization?: string;
  contacts: ProjectContact[];
  files?: Array<any>
  address?: string;
  budget?: number;
  currency: 'BRL' | 'USD' | 'EUR';
  status: ProjectStatus;
  start_date?: string;
  due_date?: string;
  completed_at?: string;
  tags: string[];
  assigned_to: string[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  progress: number; // 0-100
  notes?: string;
  attachments: ProjectAttachment[];
  
  // Audit fields
  created_by: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type ProjectStatus =
  | 'contacted'  // Em Contato
  | 'proposal'   // Com Proposta
  | 'won'        // Cliente Bem Sucedido
  | 'lost';      // Cliente Perdido

export interface ProjectContact {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export interface ProjectAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
}

export interface ProjectStatusConfig {
  id: ProjectStatus;
  name: string;
  color: string;
  description: string;
}

export interface ProjectStage {
  id: ProjectStatus;
  name: string;
  color: string;
  projects: Project[];
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  type: 'status_change' | 'comment' | 'attachment' | 'assignment' | 'deadline_change';
  description: string;
  details?: any;
  userId: string;
  userName: string;
  createdAt: string;
}

export interface ProjectComment {
  id: string;
  projectId: string;
  content: string;
  userId: string;
  userName: string;
  createdAt: string;
  updatedAt?: string;
}
