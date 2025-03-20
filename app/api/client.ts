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

            let responseData;
            try {
                responseData = await response.json() as ApiResponse<TResponse>;
            } catch (parseError) {
                console.error("Failed to parse response:", parseError);
                throw new ApiError(
                    `Failed to parse response: ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    response.status
                );
            }

            if (!response.ok) {
                console.error("API error response:", responseData);
                throw new ApiError(
                    responseData.error || `HTTP error ${response.status}`,
                    response.status,
                    responseData
                );
            }

            if (!responseData.success) {
                console.error("Operation failed:", responseData);
                const errorMessage = responseData.error || 
                                    (responseData.result && typeof responseData.result === 'object' && 'error' in responseData.result 
                                        ? responseData.result.error 
                                        : null) || 
                                    'Operation failed';
                throw new ApiError(errorMessage, undefined, responseData);
            }

            // Return the result and execution time if available
            if (responseData.executionTimeMs !== undefined || responseData.executedCommand !== undefined) {
                return {
                    result: responseData.result as TResponse,
                    executionTimeMs: responseData.executionTimeMs,
                    executedCommand: responseData.executedCommand
                };
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
        headersOrOptions?: Record<string, string> | boolean
    ) {
        // For backward compatibility, if the third parameter is a boolean, ignore it
        const headers = typeof headersOrOptions === 'object' ? headersOrOptions : undefined;
        
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
    },

    async patch<TResponse, TRequest>(
        url: string,
        data: TRequest,
        headers?: Record<string, string>
    ) {
        return this.request<TResponse, TRequest>(url, {
            method: 'PATCH',
            data,
            headers,
        });
    }
}; 