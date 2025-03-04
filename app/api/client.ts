import { ApiResponse } from './types';

export class ApiError extends Error {
    constructor(
        message: string,
        public status?: number,
        public data?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

export const apiClient = {
    async request<TResponse, TRequest = undefined>(
        url: string,
        options?: {
            method?: string;
            data?: TRequest;
            headers?: Record<string, string>;
        }
    ): Promise<TResponse> {
        const { method = 'GET', data, headers = {} } = options ?? {};
        
        try {
            const response = await fetch(url, {
                method,
                headers: {
                    ...(!(data instanceof FormData) && { 'Content-Type': 'application/json' }),
                    ...headers,
                },
                body: data instanceof FormData ? data : JSON.stringify(data),
            });

            const responseData = await response.json() as ApiResponse<TResponse>;

            if (!response.ok) {
                throw new ApiError(
                    responseData.error || `HTTP error ${response.status}`,
                    response.status,
                    responseData
                );
            }

            if (!responseData.success) {
                throw new ApiError(responseData.error || 'Operation failed');
            }

            return responseData.result as TResponse;
        } catch (error) {
            if (error instanceof ApiError) {
                throw error;
            }
            // If it's a fetch error or other error, wrap it in ApiError
            throw new ApiError(error instanceof Error ? error.message : 'Unknown error');
        }
    },

    // Convenience methods
    async get<TResponse>(url: string, headers?: Record<string, string>) {
        return this.request<TResponse>(url, { headers });
    },

    async post<TResponse, TRequest>(
        url: string,
        data: TRequest,
        headers?: Record<string, string>
    ) {
        return this.request<TResponse, TRequest>(url, {
            method: 'POST',
            data,
            headers,
        });
    },

    async delete<TResponse>(url: string, headers?: Record<string, string>) {
        return this.request<TResponse>(url, {
            method: 'DELETE',
            headers,
        });
    }
}; 