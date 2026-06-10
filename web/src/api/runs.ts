import apiClient from './client';
import type { TaskRun } from '../types';

export interface ListRunsParams {
  taskId?: string;
  status?: 'pending' | 'running' | 'completed' | 'error';
}

export async function listRuns(params: ListRunsParams = {}): Promise<TaskRun[]> {
  const res = await apiClient.get<TaskRun[]>('/runs', { params });
  return res.data;
}

export async function getRun(id: string): Promise<TaskRun> {
  const res = await apiClient.get<TaskRun>(`/runs/${id}`);
  return res.data;
}

export async function scoreRun(
  id: string,
  score: number,
  scoreNote?: string
): Promise<TaskRun> {
  const res = await apiClient.patch<TaskRun>(`/runs/${id}/score`, {
    score,
    scoreNote,
  });
  return res.data;
}

export interface CompareResult {
  task: { id: string; title: string; prompt: string };
  runs: TaskRun[];
}

export interface AiScoreResponse {
  runId: string;
  processing: boolean;
  aiScores?: any;
}

export async function aiScoreRun(
  id: string,
  judgeProviderId: string,
  judgeModelId: string,
): Promise<AiScoreResponse> {
  const res = await apiClient.post<AiScoreResponse>(`/runs/${id}/ai-score`, {
    judgeProviderId,
    judgeModelId,
  });
  return res.data;
}

export async function getAiScoreStatus(id: string): Promise<AiScoreResponse> {
  const res = await apiClient.get<AiScoreResponse>(`/runs/${id}/ai-score-status`);
  return res.data;
}

export async function deleteAiScore(id: string, index: number): Promise<any> {
  const res = await apiClient.delete(`/runs/${id}/ai-score/${index}`);
  return res.data;
}

export async function compareRuns(taskId: string): Promise<CompareResult> {
  const res = await apiClient.get<CompareResult>(`/tasks/${taskId}/compare`);
  return res.data;
}
