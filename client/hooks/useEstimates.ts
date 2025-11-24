import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

export function useEstimates() {
  const [estimates, setEstimates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEstimates = async (params: any = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getEstimates(params);
      setEstimates(response.estimates || response.items || []);
      return response;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao carregar orçamentos';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createEstimate = async (data: any) => {
    const res = await apiService.createEstimate(data);
    await loadEstimates();
    return res;
  };

  const updateEstimate = async (id: string, data: any) => {
    const res = await apiService.updateEstimate(id, data);
    await loadEstimates();
    return res;
  };

  const deleteEstimate = async (id: string) => {
    await apiService.deleteEstimate(id);
    await loadEstimates();
  };

  const getEstimateStats = async () => {
    return apiService.getEstimateStats();
  };

  useEffect(() => {
    loadEstimates();
  }, []);

  return {
    estimates,
    isLoading,
    error,
    loadEstimates,
    createEstimate,
    updateEstimate,
    deleteEstimate,
    getEstimateStats,
  };
}