
import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';

interface DashboardMetrics {
  financial: {
    revenue: number;
    expenses: number;
    balance: number;
    thisMonth: {
      revenue: number;
      expenses: number;
    };
    invoices: {
      total: number;
      paid: number;
      pending: number;
      overdue: number;
    };
  };
  clients: {
    total: number;
    active: number;
    inactive: number;
    thisMonth: number;
  };
  projects: {
    total: number;
    contacted: number;
    proposal: number;
    won: number;
    lost: number;
    thisMonth: number;
  };
  tasks: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    urgent: number;
  };
  publications?: {
    total: number;
    novo: number;
    lido: number;
    arquivado: number;
    thisMonth: number;
  };
}

interface RecentActivity {
  id: string;
  type: 'client' | 'project' | 'task' | 'transaction' | 'invoice' | 'publication';
  title: string;
  description: string;
  date: string;
  status?: string;
  amount?: number;
}

export function useDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getDefaultMetrics = (): DashboardMetrics => ({
    financial: {
      revenue: 0,
      expenses: 0,
      balance: 0,
      thisMonth: { revenue: 0, expenses: 0 },
      invoices: { total: 0, paid: 0, pending: 0, overdue: 0 }
    },
    clients: { total: 0, active: 0, inactive: 0, thisMonth: 0 },
    projects: { total: 0, contacted: 0, proposal: 0, won: 0, lost: 0, thisMonth: 0 },
    tasks: { total: 0, completed: 0, inProgress: 0, notStarted: 0, urgent: 0 }
  });

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('🔄 Loading dashboard data...');
      // ✅ Usar endpoint completo correto
      const response = await apiService.get('/api/dashboard');
      
      console.log('📊 Dashboard response received:', response);
      
      // ✅ response do axios já vem em response.data
      const apiData = response;
      
      // Validate response structure
      if (!apiData || typeof apiData !== 'object') {
        throw new Error('Invalid response format');
      }
      
      // Extract data from unified response
      const metricsData = apiData.metrics || getDefaultMetrics();
      const chartData = apiData.charts || null;
      const activityData = apiData.recentActivity || [];
      
      // Ensure all required properties exist
      const validatedMetrics = {
        financial: metricsData.financial || getDefaultMetrics().financial,
        clients: metricsData.clients || getDefaultMetrics().clients,
        projects: metricsData.projects || getDefaultMetrics().projects,
        tasks: metricsData.tasks || getDefaultMetrics().tasks,
        publications: metricsData.publications
      };
      
      // ✅ VALIDAR chartData antes de setar
      const validatedChartData = chartData && typeof chartData === 'object' ? {
        financial: chartData.financial || null,
        projects: Array.isArray(chartData.projects) ? chartData.projects : [],
        tasks: Array.isArray(chartData.tasks) ? chartData.tasks : []
      } : null;
      
      setMetrics(validatedMetrics);
      setChartData(validatedChartData);
      setRecentActivity(Array.isArray(activityData) ? activityData : []);
      
      console.log('✅ Dashboard data loaded successfully', {
        hasMetrics: !!validatedMetrics,
        hasCharts: !!validatedChartData,
        activityCount: activityData.length
      });
      
      return { metrics: validatedMetrics, charts: validatedChartData, recentActivity: activityData };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      console.error('Dashboard data error:', err);
      
      // Set default data to prevent rendering errors
      const defaultMetrics = getDefaultMetrics();
      setMetrics(defaultMetrics);
      setChartData(null);
      setRecentActivity([]);
      return { metrics: defaultMetrics, charts: null, recentActivity: [] };
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecentActivity = async (limit: number = 10) => {
    console.log('⚠️ loadRecentActivity: This method is deprecated. Use loadDashboardData instead.');
    return [];
  };

  const loadChartData = async (period: string = '30d') => {
    console.log('⚠️ loadChartData: This method is deprecated. Use loadDashboardData instead.');
    return null;
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        console.log('🚀 Initializing dashboard data load...');
        await loadDashboardData();
      } catch (error) {
        console.error('Error loading initial dashboard data:', error);
      }
    };

    loadInitialData();
  }, []);

  return {
    metrics,
    recentActivity,
    chartData,
    isLoading,
    error,
    loadDashboardData,
    loadRecentActivity,
    loadChartData,
  };
}
