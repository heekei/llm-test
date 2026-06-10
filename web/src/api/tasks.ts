import apiClient from './client';
import type { Task, CreateTaskInput } from '../types';

export async function listTasks(): Promise<Task[]> {
  const res = await apiClient.get<Task[]>('/tasks');
  return res.data;
}

export async function getTask(id: string): Promise<Task> {
  const res = await apiClient.get<Task>(`/tasks/${id}`);
  return res.data;
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const res = await apiClient.post<Task>('/tasks', input);
  return res.data;
}

export async function deleteTask(id: string): Promise<void> {
  await apiClient.delete(`/tasks/${id}`);
}

// SSE endpoint URL (consumed by useSse composable)
export function getRunStreamUrl(taskId: string): string {
  return `/api/tasks/${taskId}/run`;
}
