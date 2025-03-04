import { ApiError } from './client';

export interface UserSettingsResponse<T = any> {
    value: T;
}

export const userSettings = {
    async get<T = any>(key: string): Promise<T | null> {
        try {
            const response = await fetch(`/api/usersettings/${key}`);
            if (!response.ok) {
                if (response.status === 404) {
                    return null;
                }
                throw new ApiError(`Failed to get setting: ${key}`, response.status);
            }
            const data = await response.json() as UserSettingsResponse<T>;
            return data.value;
        } catch (error) {
            console.error('Error getting setting:', error);
            throw error;
        }
    },

    async set<T = any>(key: string, value: T): Promise<void> {
        try {
            const response = await fetch(`/api/usersettings/${key}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ value }),
            });
            if (!response.ok) {
                throw new ApiError(`Failed to set setting: ${key}`, response.status);
            }
        } catch (error) {
            console.error('Error setting value:', error);
            throw error;
        }
    },

    async delete(key: string): Promise<void> {
        try {
            const response = await fetch(`/api/usersettings/${key}`, {
                method: 'DELETE',
            });
            if (!response.ok && response.status !== 404) {
                throw new ApiError(`Failed to delete setting: ${key}`, response.status);
            }
        } catch (error) {
            console.error('Error deleting setting:', error);
            throw error;
        }
    },
}; 