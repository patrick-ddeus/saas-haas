import { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { Task } from '../types/tasks';

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = async (params: any = {}) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await apiService.getTasks(params);
      
      // Transform snake_case to camelCase for frontend
      const transformedTasks = response.tasks.map((task: any) => ({
        ...task,
        projectId: task.project_id,
        projectTitle: task.project_title,
        clientId: task.client_id,
        clientName: task.client_name,
        assignedTo: task.assigned_to,
        startDate: task.start_date,
        endDate: task.end_date,
        estimatedHours: task.estimated_hours,
        actualHours: task.actual_hours,
        createdBy: task.created_by,
        createdAt: task.created_at,
        updatedAt: task.updated_at,
        isActive: task.is_active,
        attachments: task.attachments || [], // Ensure attachments array exists
        tags: task.tags || [], // Ensure tags array exists
        subtasks: task.subtasks || [], // Ensure subtasks array exists
      }));
      
      setTasks(transformedTasks);
      return { ...response, tasks: transformedTasks };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load tasks';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const createTask = async (data: any) => {
    try {
      console.log('[useTasks] Creating task:', data);
      const response = await apiService.createTask(data);
      console.log('[useTasks] Task created, reloading list...');
      await loadTasks(); // Reload list
      return response;
    } catch (err) {
      console.error('[useTasks] Error creating task:', err);
      throw err;
    }
  };

  const updateTask = async (id: string, data: any) => {
    try {
      const response = await apiService.updateTask(id, data);
      await loadTasks(); // Reload list
      return response;
    } catch (err) {
      throw err;
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await apiService.deleteTask(id);
      await loadTasks(); // Reload list
    } catch (err) {
      throw err;
    }
  };

  const getTaskStats = async () => {
    try {
      return await apiService.getTaskStats();
    } catch (err) {
      throw err;
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  return {
    tasks,
    isLoading,
    error,
    loadTasks,
    createTask,
    updateTask,
    deleteTask,
    getTaskStats,
  };
}