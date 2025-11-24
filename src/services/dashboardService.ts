/**
 * DASHBOARD SERVICE - Métricas e Estatísticas
 * ==========================================
 * 
 * ✅ ISOLAMENTO TENANT: Usa TenantDatabase e helpers de isolamento
 * ✅ SEM DADOS MOCK: Agrega métricas reais de todos os módulos
 * ✅ CONTROLE DE ACESSO: Respeita restrições por tipo de conta
 */

import { TenantDatabase } from '../config/database';
import { queryTenantSchema } from '../utils/tenantHelpers';
import { clientsService } from './clientsService';
import { projectsService } from './projectsService';
import { tasksService } from './tasksService';
import { transactionsService } from './transactionsService';
import { invoicesService } from './invoicesService';
import { publicationsService } from './publicationsService';

export interface DashboardMetrics {
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

export interface RecentActivity {
  id: string;
  type: 'client' | 'project' | 'task' | 'transaction' | 'invoice' | 'publication';
  title: string;
  description: string;
  date: string;
  status?: string;
  amount?: number;
}

export class DashboardService {
  /**
   * Obtém métricas agregadas do dashboard
   */
  async getDashboardMetrics(tenantDB: TenantDatabase, userId: string | undefined, accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL'): Promise<DashboardMetrics> {
    console.log('📊 [DashboardService] Fetching metrics for account type:', accountType);

    const [ clientsStats, projectsStats, tasksStats ] = await Promise.all([
      clientsService.getClientsStats(tenantDB),
      projectsService.getProjectsStats(tenantDB),
      tasksService.getTaskStats(tenantDB)
    ]);

    let financialStats = {
      revenue: 0,
      expenses: 0,
      balance: 0,
      thisMonth: { revenue: 0, expenses: 0 },
      invoices: { total: 0, paid: 0, pending: 0, overdue: 0 }
    };

    let publicationsStats;

    if (accountType === 'COMPOSTA' || accountType === 'GERENCIAL') {
      console.log('💰 [DashboardService] Fetching financial data from transactions...');

      const [ transactionsStats, invoicesStats ] = await Promise.all([
        transactionsService.getTransactionsStats(tenantDB),
        invoicesService.getInvoicesStats(tenantDB)
      ]);

      console.log('📈 [DashboardService] Transactions stats:', transactionsStats);
      console.log('📄 [DashboardService] Invoices stats:', invoicesStats);

      financialStats = {
        revenue: transactionsStats.totalIncome,
        expenses: transactionsStats.totalExpense,
        balance: transactionsStats.netAmount,
        thisMonth: {
          revenue: transactionsStats.thisMonthIncome,
          expenses: transactionsStats.thisMonthExpense
        },
        invoices: {
          total: invoicesStats.total,
          paid: invoicesStats.paid,
          pending: invoicesStats.pending,
          overdue: invoicesStats.overdue
        }
      };

      console.log('✅ [DashboardService] Financial stats calculated:', financialStats);
    } else {
      console.log('⚠️ [DashboardService] Account type SIMPLES - financial data disabled');
    }

    if (userId) {
      publicationsStats = await publicationsService.getPublicationsStats(tenantDB, userId);
    }

    return {
      financial: financialStats,
      clients: clientsStats,
      projects: {
        total: projectsStats.total,
        contacted: projectsStats.byStatus.contacted,
        proposal: projectsStats.byStatus.proposal,
        won: projectsStats.byStatus.won,
        lost: projectsStats.byStatus.lost,
        thisMonth: 0
      },
      tasks: {
        total: parseInt(String(tasksStats.total)) || 0,
        completed: parseInt(String(tasksStats.completed)) || 0,
        inProgress: parseInt(String(tasksStats.inProgress)) || 0,
        notStarted: parseInt(String(tasksStats.notStarted)) || 0,
        urgent: parseInt(String(tasksStats.urgent)) || 0
      },
      publications: publicationsStats
    };
  }

  /**
   * Obtém atividades recentes do usuário
   */
  async getRecentActivity(tenantDB: TenantDatabase, userId: string | undefined, limit: number = 10): Promise<RecentActivity[]> {
    if (!userId) {
      return [];
    }

    const activities: RecentActivity[] = [];

    const [ recentClients, recentProjects, recentTasks, recentInvoices ] = await Promise.all([
      clientsService.getClients(tenantDB, { limit: 5, page: 1 }),
      projectsService.getProjects(tenantDB, { limit: 5, page: 1 }),
      tasksService.getTasks(tenantDB, { limit: 5, page: 1 }),
      invoicesService.getInvoices(tenantDB, { limit: 20, page: 1 })
    ]);

    recentClients.clients.forEach(client => {
      activities.push({
        id: client.id,
        type: 'client',
        title: `Cliente: ${client.name}`,
        description: `Novo cliente adicionado`,
        date: client.createdAt,
        status: client.status
      });
    });

    recentProjects.projects.forEach(project => {
      activities.push({
        id: project.id,
        type: 'project',
        title: `Projeto: ${project.title}`,
        description: `Cliente: ${project.client_name}`,
        date: project.created_at,
        status: project.status,
        amount: project.budget
      });
    });

    recentTasks.tasks.forEach(task => {
      activities.push({
        id: task.id,
        type: 'task',
        title: `Tarefa: ${task.title}`,
        description: `Progresso: ${task.progress}%`,
        date: task.created_at,
        status: task.status
      });
    });

    // 🔗 Incluir faturas vencendo/próximas
    recentInvoices.invoices
      .filter(inv => ['pending', 'sent', 'overdue'].includes(inv.status))
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, Math.min(5, limit)) // limitar quantidade de faturas adicionadas
      .forEach(inv => {
        activities.push({
          id: inv.id,
          type: 'invoice',
          title: `Fatura ${inv.number} - ${inv.client_name}`,
          description: inv.title || `Fatura para ${inv.client_name}`,
          date: inv.due_date,
          status: inv.status,
          amount: Number(inv.amount)
        });
      });

    return activities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, limit);
  }

  /**
   * Obtém dados para gráficos do dashboard
   */
  async getChartData(tenantDB: TenantDatabase, accountType: 'SIMPLES' | 'COMPOSTA' | 'GERENCIAL', period: string = '30d') {
    console.log('📊 [DashboardService] Getting chart data for period:', period);

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 30);
    const dateFromStr = dateFrom.toISOString().split('T')[ 0 ];

    console.log('📅 [DashboardService] Date range from:', dateFromStr);

    let financialData = null;

    if (accountType === 'COMPOSTA' || accountType === 'GERENCIAL') {
      console.log('💰 [DashboardService] Fetching categories and cash flow...');

      // Busca categorias de receitas e despesas em paralelo
      const [ incomeCategories, expenseCategories ] = await Promise.all([
        transactionsService.getTransactionsByCategory(tenantDB, 'income', dateFromStr),
        transactionsService.getTransactionsByCategory(tenantDB, 'expense', dateFromStr)
      ]);

      console.log('📈 [DashboardService] Income categories:', incomeCategories);
      console.log('📉 [DashboardService] Expense categories:', expenseCategories);

      const cashFlowData = await this.getCashFlowData(tenantDB, dateFromStr);
      console.log('💵 [DashboardService] Cash flow data:', cashFlowData);

      // ✅ SEMPRE retornar estrutura, mesmo vazia
      financialData = {
        categories: {
          income: Array.isArray(incomeCategories) ? incomeCategories : [],
          expense: Array.isArray(expenseCategories) ? expenseCategories : []
        },
        cashFlow: Array.isArray(cashFlowData) ? cashFlowData : []
      };

      console.log('✅ [DashboardService] Financial chart data prepared:', financialData);
    }

    return {
      financial: financialData,
      projects: await this.getProjectsChartData(tenantDB, dateFromStr),
      tasks: await this.getTasksChartData(tenantDB, dateFromStr)
    };
  }

  /**
   * Dados do fluxo de caixa para gráficos
   */
  private async getCashFlowData(tenantDB: TenantDatabase, dateFrom: string) {
    const query = `
    SELECT 
      DATE(date) as day,
      -- ✅ GARANTE QUE O TIPO DE DADO DE SAÍDA SEJA CONSISTENTE
      SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END)::DECIMAL(15,2) as income,
      SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END)::DECIMAL(15,2) as expense
    FROM \${schema}.transactions
    WHERE is_active = TRUE AND date >= $1::date
    GROUP BY DATE(date)
    ORDER BY day ASC
  `;

    const result = await queryTenantSchema(tenantDB, query, [ dateFrom ]);

    // Adicione este log para a verificação final
    console.log('Dados do Fluxo de Caixa (depois da query, antes do map):', JSON.stringify(result, null, 2));

    return result.map((row: any) => ({
      day: row.day,
      income: parseFloat(row.income || '0'),
      expense: parseFloat(row.expense || '0'),
      net: parseFloat(row.income || '0') - parseFloat(row.expense || '0')
    }));
  }

  /**
   * Dados de projetos para gráficos
   */
  private async getProjectsChartData(tenantDB: TenantDatabase, dateFrom: string) {
    const query = `
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(budget), 0) as total_budget
      FROM \${schema}.projects
      WHERE is_active = TRUE AND updated_at >= $1::date
      GROUP BY status
    `;

    const result = await queryTenantSchema(tenantDB, query, [ dateFrom ]);
    return result.map((row: any) => ({
      status: row.status,
      count: parseInt(row.count || '0'),
      totalBudget: parseFloat(row.total_budget || '0')
    }));
  }

  /**
   * Dados de tarefas para gráficos
   */
  private async getTasksChartData(tenantDB: TenantDatabase, dateFrom: string) {
    const query = `
      SELECT 
        status,
        priority,
        COUNT(*) as count,
        AVG(progress) as avg_progress
      FROM \${schema}.tasks
      WHERE is_active = TRUE AND updated_at >= $1::date
      GROUP BY status, priority
    `;

    const result = await queryTenantSchema(tenantDB, query, [ dateFrom ]);
    return result.map((row: any) => ({
      status: row.status,
      priority: row.priority,
      count: parseInt(row.count || '0'),
      avgProgress: parseFloat(row.avg_progress || '0')
    }));
  }
}

export const dashboardService = new DashboardService();
