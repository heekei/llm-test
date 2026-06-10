import apiClient from './client';
import type {
  Provider,
  ModelInfo,
  CreateProviderInput,
  UpdateProviderInput,
} from '../types';

export async function listProviders(): Promise<Provider[]> {
  const res = await apiClient.get<Provider[]>('/providers');
  return res.data;
}

export async function getProvider(id: string): Promise<Provider> {
  const res = await apiClient.get<Provider>(`/providers/${id}`);
  return res.data;
}

export async function createProvider(
  input: CreateProviderInput
): Promise<Provider> {
  const res = await apiClient.post<Provider>('/providers', input);
  return res.data;
}

export async function updateProvider(
  id: string,
  input: UpdateProviderInput
): Promise<Provider> {
  const res = await apiClient.patch<Provider>(`/providers/${id}`, input);
  return res.data;
}

export async function deleteProvider(id: string): Promise<void> {
  await apiClient.delete(`/providers/${id}`);
}

export async function fetchProviderModels(
  providerId: string
): Promise<ModelInfo[]> {
  const res = await apiClient.post<ModelInfo[]>(
    `/providers/${providerId}/models/fetch`
  );
  return res.data;
}

export async function getProviderModels(
  providerId: string
): Promise<ModelInfo[]> {
  const res = await apiClient.get<ModelInfo[]>(
    `/providers/${providerId}/models`
  );
  return res.data;
}

export async function getAllModels(): Promise<ModelInfo[]> {
  const res = await apiClient.get<ModelInfo[]>('/models');
  return res.data;
}
