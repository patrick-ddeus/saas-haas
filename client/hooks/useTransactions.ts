/**
 * USE TRANSACTIONS HOOK - Hook para gerenciar transações do Fluxo de Caixa
 * =========================================================================
 * 
 * Hook React customizado para gerenciar estado e operações de transações
 * financeiras. Substitui os dados mock por integração real com o backend.
 */

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '../services/apiService';
import { Transaction } from '../types/cashflow';

interface UseTransactionsOptions {
  autoLoad?: boolean;
  page?: number;
  limit?: number;
  type?: 'income' | 'expense';
  status?: string;
  categoryId?: string;
  search?: string;
  tags?: string[];
  projectId?: string;
  clientId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
  isRecurring?: boolean;
}

interface UseTransactionsReturn {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  pagination: any;
  loadTransactions: (options?: UseTransactionsOptions) => Promise<any>;
  createTransaction: (data: any) => Promise<any>;
  updateTransaction: (id: string, data: any) => Promise<any>;
  deleteTransaction: (id: string) => Promise<void>;
  refreshTransactions: () => Promise<void>;
}

export function useTransactions(initialOptions: UseTransactionsOptions = {}): UseTransactionsReturn {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<any>(null);
  const [currentOptions, setCurrentOptions] = useState<UseTransactionsOptions>(initialOptions);

  /**
   * Carrega transações do backend com filtros
   */
  const loadTransactions = useCallback(async (options: UseTransactionsOptions = {}) => {
    try {
      setIsLoading(true);
      setError(null);

      const mergedOptions = { ...currentOptions, ...options };
      setCurrentOptions(mergedOptions);

      // Preparar parâmetros da query
      const params: Record<string, any> = {};
      
      if (mergedOptions.page) params.page = mergedOptions.page;
      if (mergedOptions.limit) params.limit = mergedOptions.limit;
      if (mergedOptions.type) params.type = mergedOptions.type;
      if (mergedOptions.status) params.status = mergedOptions.status;
      if (mergedOptions.categoryId) params.categoryId = mergedOptions.categoryId;
      if (mergedOptions.search) params.search = mergedOptions.search;
      if (mergedOptions.projectId) params.projectId = mergedOptions.projectId;
      if (mergedOptions.clientId) params.clientId = mergedOptions.clientId;
      if (mergedOptions.dateFrom) params.dateFrom = mergedOptions.dateFrom;
      if (mergedOptions.dateTo) params.dateTo = mergedOptions.dateTo;
      if (mergedOptions.paymentMethod) params.paymentMethod = mergedOptions.paymentMethod;
      if (mergedOptions.isRecurring !== undefined) params.isRecurring = mergedOptions.isRecurring;
      if (mergedOptions.tags && mergedOptions.tags.length > 0) {
        params.tags = mergedOptions.tags;
      }

      console.log('[useTransactions] Loading transactions with params:', params);

      const response = await apiService.getTransactions(params);
      
      console.log('[useTransactions] Transactions loaded:', {
        count: response.transactions?.length || 0,
        pagination: response.pagination
      });

      // Transformar dados do backend para o formato frontend
      const transformedTransactions = (response.transactions || []).map((t: any) => ({
        id: t.id,
        type: t.type,
        amount: parseFloat(t.amount),
        category: t.category,
        categoryId: t.category_id,
        description: t.description,
        date: t.date,
        paymentMethod: t.payment_method,
        status: t.status,
        projectId: t.project_id,
        projectTitle: t.project_title,
        clientId: t.client_id,
        clientName: t.client_name,
        tags: Array.isArray(t.tags) ? t.tags : [],
        notes: t.notes,
        isRecurring: t.is_recurring || false,
        recurringFrequency: t.recurring_frequency,
        createdBy: t.created_by,
        lastModifiedBy: t.last_modified_by,
        isActive: t.is_active !== false,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        attachments: []
      }));

      setTransactions(transformedTransactions);
      setPagination(response.pagination || null);
      
      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar transações';
      console.error('[useTransactions] Error loading transactions:', err);
      setError(errorMessage);
      setTransactions([]);
      setPagination(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [currentOptions]);

  /**
   * Cria nova transação
   */
  const createTransaction = useCallback(async (data: any): Promise<any> => {
    try {
      setError(null);

      // Preparar dados para o backend
      const payload = {
        type: data.type,
        amount: data.amount,
        categoryId: data.categoryId,
        category: data.category || data.categoryId, // Garantir que category sempre existe
        description: data.description,
        date: data.date,
        paymentMethod: data.paymentMethod,
        status: data.status || 'confirmed',
        projectId: data.projectId,
        projectTitle: data.projectTitle,
        clientId: data.clientId,
        clientName: data.clientName,
        tags: data.tags || [],
        notes: data.notes,
        isRecurring: data.isRecurring || false,
        recurringFrequency: data.recurringFrequency
      };

      console.log('[useTransactions] Creating transaction:', payload);

      const response = await apiService.createTransaction(payload);
      
      console.log('[useTransactions] Transaction created:', response);

      // Recarregar lista de transações
      await loadTransactions(currentOptions);

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar transação';
      console.error('[useTransactions] Error creating transaction:', err);
      setError(errorMessage);
      throw err;
    }
  }, [loadTransactions, currentOptions]);

  /**
   * Atualiza transação existente
   */
  const updateTransaction = useCallback(async (id: string, data: any): Promise<any> => {
    try {
      setError(null);

      // Preparar dados para o backend
      // IMPORTANTE: Verifica se o campo é !== undefined para permitir limpar campos (null, '', [])
      const payload: any = {};
      
      if (data.type !== undefined) payload.type = data.type;
      if (data.amount !== undefined) payload.amount = data.amount;
      if (data.categoryId !== undefined) payload.categoryId = data.categoryId;
      if (data.category !== undefined) payload.category = data.category;
      if (data.categoryId !== undefined && data.category === undefined) {
        // Se categoryId foi atualizado mas category não, usar categoryId como fallback
        payload.category = data.categoryId;
      }
      if (data.description !== undefined) payload.description = data.description;
      if (data.date !== undefined) payload.date = data.date;
      if (data.paymentMethod !== undefined) payload.paymentMethod = data.paymentMethod;
      if (data.status !== undefined) payload.status = data.status;
      if (data.projectId !== undefined) payload.projectId = data.projectId;
      if (data.projectTitle !== undefined) payload.projectTitle = data.projectTitle;
      if (data.clientId !== undefined) payload.clientId = data.clientId;
      if (data.clientName !== undefined) payload.clientName = data.clientName;
      if (data.tags !== undefined) payload.tags = data.tags;
      if (data.notes !== undefined) payload.notes = data.notes;
      if (data.isRecurring !== undefined) payload.isRecurring = data.isRecurring;
      if (data.recurringFrequency !== undefined) payload.recurringFrequency = data.recurringFrequency;

      console.log('[useTransactions] Updating transaction:', id, payload);

      const response = await apiService.updateTransaction(id, payload);

      console.log('[useTransactions] Transaction updated:', response);

      // Recarregar lista de transações
      await loadTransactions(currentOptions);

      return response;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar transação';
      console.error('[useTransactions] Error updating transaction:', err);
      setError(errorMessage);
      throw err;
    }
  }, [loadTransactions, currentOptions]);

  /**
   * Deleta transação (soft delete)
   */
  const deleteTransaction = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);

      console.log('[useTransactions] Deleting transaction:', id);

      await apiService.deleteTransaction(id);

      console.log('[useTransactions] Transaction deleted:', id);

      // Recarregar lista de transações
      await loadTransactions(currentOptions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao deletar transação';
      console.error('[useTransactions] Error deleting transaction:', err);
      setError(errorMessage);
      throw err;
    }
  }, [loadTransactions, currentOptions]);

  /**
   * Recarrega transações com os mesmos filtros
   */
  const refreshTransactions = useCallback(async () => {
    await loadTransactions(currentOptions);
  }, [loadTransactions, currentOptions]);

  // Auto-carregar transações na inicialização se autoLoad=true
  useEffect(() => {
    if (initialOptions.autoLoad !== false) {
      loadTransactions(initialOptions);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    transactions,
    isLoading,
    error,
    pagination,
    loadTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    refreshTransactions
  };
}
