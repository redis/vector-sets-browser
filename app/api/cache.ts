import { apiClient } from './client';

export interface CacheInfo {
    size: number;
    items: {
        key: string;
        size: number;
        lastAccessed: string;
    }[];
}

export const cache = {
    async getInfo(): Promise<CacheInfo> {
        return apiClient.get('/api/cache');
    },

    async clear(): Promise<void> {
        return apiClient.delete('/api/cache');
    },

    async clearItem(key: string): Promise<void> {
        return apiClient.delete('/api/cache', { key });
    }
}; 