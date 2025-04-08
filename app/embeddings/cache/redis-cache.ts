import { RedisConnection, getRedisUrl } from "@/app/redis-server/RedisConnection"
import { EmbeddingConfig } from "../types/embeddingModels"

export const EMBEDDING_CACHE_KEY = "embeddingCache"
export const EMBEDDING_CACHE_LOG_KEY = "embeddingCache:log"

export class EmbeddingCache {
    async get(input: string, config: EmbeddingConfig): Promise<number[] | null> {
        try {
            const redisUrl = await getRedisUrl()
            if (!redisUrl) {
                return null
            }

            return await RedisConnection.withClient(redisUrl, async (client) => {
                const field = this.generateHashField(input, config)
                const cached = await client.hGet(EMBEDDING_CACHE_KEY, field)

                if (cached) {
                    // Update access time in sorted set
                    await client.zAdd(EMBEDDING_CACHE_LOG_KEY, {
                        score: Date.now(),
                        value: field,
                    })
                    return JSON.parse(cached)
                }

                return null
            }).then((result) => {
                if (!result.success) {
                    console.error("[Embedding] Cache read error:", result.error)
                    return null
                }
                return result.result
            })
        } catch (error) {
            console.error("[Embedding] Cache read error:", error)
            return null
        }
    }

    async set(input: string, embedding: number[], config: EmbeddingConfig): Promise<void> {
        try {
            const redisUrl = await getRedisUrl()
            if (!redisUrl) {
                return
            }

            const field = this.generateHashField(input, config)

            await RedisConnection.withClient(redisUrl, async (client) => {
                // Store the embedding in the hash
                await client.hSet(
                    EMBEDDING_CACHE_KEY,
                    field,
                    JSON.stringify(embedding)
                )

                // Update access time in sorted set
                await client.zAdd(EMBEDDING_CACHE_LOG_KEY, {
                    score: Date.now(),
                    value: field,
                })

                return true
            })
        } catch (error) {
            console.error("[Embedding] Cache write error:", error)
        }
    }

    private generateHashField(input: string, config: EmbeddingConfig): string {
        // Create a unique hash field based on the input and provider configuration
        const provider = config.provider
        let modelIdentifier = ""

        switch (provider) {
            case "openai":
                modelIdentifier = config.openai?.model || ""
                break
            case "ollama":
                modelIdentifier = config.ollama?.modelName || ""
                break
            case "tensorflow":
                modelIdentifier = config.tensorflow?.model || ""
                break
            case "image":
                modelIdentifier = config.image?.model || ""
                break
            // Add other providers as needed
        }

        // Create a hash of the input to avoid special characters
        const inputHash = Buffer.from(input).toString("base64").substring(0, 40)
        return `${provider}:${modelIdentifier}:${inputHash}`
    }
} 