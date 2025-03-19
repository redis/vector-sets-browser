interface RedisResponse {
    success?: boolean
    error?: string
    message?: string
    url?: string
}

export class RedisService {
    static async connect(url: string): Promise<RedisResponse> {
        try {
            const response = await fetch("/api/redis/connect", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to connect to Redis")
            }

            return data
        } catch (error) {
            throw error instanceof Error
                ? error
                : new Error("Failed to connect to Redis")
        }
    }

    static async disconnect(): Promise<RedisResponse> {
        try {
            const response = await fetch("/api/redis/connect", {
                method: "DELETE",
            })

            const data = await response.json()

            if (!response.ok) {
                throw new Error(data.error || "Failed to disconnect from Redis")
            }

            return data
        } catch (error) {
            throw error instanceof Error
                ? error
                : new Error("Failed to disconnect from Redis")
        }
    }
}
