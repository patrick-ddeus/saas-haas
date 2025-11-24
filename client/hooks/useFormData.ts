
import { useState, useEffect } from 'react';
import { apiService } from '@/services/apiService';

interface Project {
  id: string;
  title: string;
}

interface Client {
  id: string;
  name: string;
}

interface Collaborator {
  id: string;
  name: string;
  email: string;
  accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL';
  isActive: boolean;
}

export function useFormData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [projectsResponse, clientsResponse, collaboratorsResponse] = await Promise.all([
          apiService.getProjects({ limit: 100 }),
          apiService.getClients({ limit: 100 }),
          apiService.getCollaborators({ status: 'active', limit: 200 }),
        ]);

        setProjects(projectsResponse.projects || []);
        setClients(clientsResponse.clients || []);
        setCollaborators(collaboratorsResponse.collaborators || []);
      } catch (err) {
        console.error('Error loading form data:', err);
        setError('Falha ao carregar dados');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  return {
    projects,
    clients,
    collaborators,
    isLoading,
    error,
  };
}
