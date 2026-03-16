import { apiClient } from '@/services/api-client';
import type {
  BodyStat,
  ProgressSummary,
  ProgressPhoto,
  CreateBodyStatPayload,
  CreateProgressPhotoPayload,
} from './types';

export const progressApi = {
  // Body Stats
  getBodyStats: (memberId: string, limit = 50) =>
    apiClient.get<BodyStat[]>(`/members/${memberId}/body-stats`, { params: { limit } }),

  createBodyStat: (memberId: string, data: CreateBodyStatPayload) =>
    apiClient.post<BodyStat>(`/members/${memberId}/body-stats`, data),

  updateBodyStat: (statsId: string, data: Partial<CreateBodyStatPayload>) =>
    apiClient.patch<BodyStat>(`/members/body-stats/${statsId}`, data),

  deleteBodyStat: (statsId: string) =>
    apiClient.delete(`/members/body-stats/${statsId}`),

  // Progress Summary
  getProgressSummary: (memberId: string) =>
    apiClient.get<ProgressSummary>(`/members/${memberId}/progress`),

  // Progress Photos
  getProgressPhotos: (memberId: string) =>
    apiClient.get<ProgressPhoto[]>(`/members/${memberId}/progress-photos`),

  createProgressPhoto: (memberId: string, data: CreateProgressPhotoPayload) =>
    apiClient.post<ProgressPhoto>(`/members/${memberId}/progress-photos`, data),

  deleteProgressPhoto: (photoId: string) =>
    apiClient.delete(`/members/progress-photos/${photoId}`),
};
