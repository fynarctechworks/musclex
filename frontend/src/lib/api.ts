/**
 * Re-export from the canonical API client.
 * All new code should import directly from '@/services/api-client'.
 * This file exists only for backward compatibility with existing pages.
 */
export { apiClient, api, type ApiError, type RequestConfig } from '@/services/api-client';
