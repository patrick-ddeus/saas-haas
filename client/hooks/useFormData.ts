
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

export function useFormData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const [projectsResponse, clientsResponse] = await Promise.all([
          apiService.getProjects({ limit: 100 }),
          apiService.getClients({ limit: 100 })
        ]);

        setProjects(projectsResponse.projects || []);
        setClients(clientsResponse.clients || []);
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
    isLoading,
    error,
  };
}
