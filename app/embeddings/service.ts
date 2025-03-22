import { EmbeddingConfig, getExpectedDimensions } from "./types/config"
import { OpenAIProvider } from "./providers/openai"
import { OllamaProvider } from "./providers/ollama"
import { TensorFlowProvider } from "./providers/tensorflow"
import { ImageProvider } from "./providers/image"
import { EmbeddingProvider } from "./providers/base"
import { validateVector } from "./utils/validation"
import { EmbeddingCache } from "./cache/redis-cache"
import { PROVIDERS } from "./constants"

export class EmbeddingService {
    private providers: Map<string, EmbeddingProvider>
    private cache: EmbeddingCache

    constructor() {
        this.providers = new Map()
        this.providers.set(PROVIDERS.OPENAI, new OpenAIProvider())
        this.providers.set(PROVIDERS.OLLAMA, new OllamaProvider())
        this.providers.set(PROVIDERS.TENSORFLOW, new TensorFlowProvider())
        this.providers.set(PROVIDERS.IMAGE, new ImageProvider())
        // Add other providers as they're implemented

        this.cache = new EmbeddingCache()
    }

    async getEmbedding(
        input: string,
        config: EmbeddingConfig,
        isImage: boolean = false
    ): Promise<number[]> {
        console.log("[EmbeddingService] Getting embedding for input:", input.substring(0, 10), "...")
        // For image data, ensure we're using the image provider
        if (isImage && config.provider !== PROVIDERS.IMAGE) {
            throw new Error(`Provider ${config.provider} does not support image data`)
        }
        
        if (config.provider === PROVIDERS.IMAGE && !isImage) {
            throw new Error("Image provider requires image data")
        }

        // Check cache first if caching is enabled
        const cachedEmbedding = await this.cache.get(input, config)
        if (cachedEmbedding) {
            console.log("[EmbeddingService] Returning cached embedding")
            return cachedEmbedding
        }

        const provider = this.providers.get(config.provider)
        if (!provider) {
            throw new Error(`Unsupported provider: ${config.provider}`)
        }

        const embedding = await provider.getEmbedding(input, config)
        // TODO: Validate the embedding
        // THIS DOES NOT WORK WITH REDUCE... WE lose track of the original embedding size
        // and the VDIM returns the REDUCE size...
        // ideally we should remember the original embedding size and use that,
        // but the question is with REDUCE can you throw any size embedding at it, and it will
        // normalize it to the expected dimensions? 
        // TODO: We should test this... 
        const expectedDimensions = getExpectedDimensions(config)
        // Validate the embedding 
        const validationResult = validateVector(
            embedding, 
            expectedDimensions
        )
        if (!validationResult.isValid) {
            throw new Error(
                `Invalid embedding from ${config.provider}: ${validationResult.error}`
            )
        }

        // Cache the result if caching is enabled
        await this.cache.set(input, embedding, config)

        // Return the original embedding, not normalized
        return embedding
    }

    async getBatchEmbeddings(
        inputs: string[],
        config: EmbeddingConfig,
        areImages: boolean = false
    ): Promise<number[][]> {
        // For image data, ensure we're using the image provider
        if (areImages && config.provider !== PROVIDERS.IMAGE) {
            throw new Error(`Provider ${config.provider} does not support image data`)
        }
        
        if (config.provider === PROVIDERS.IMAGE && !areImages) {
            throw new Error("Image provider requires image data")
        }

        const provider = this.providers.get(config.provider)
        if (!provider) {
            throw new Error(`Unsupported provider: ${config.provider}`)
        }

        // Check cache first if caching is enabled
        const embeddings: number[][] = []
        const uncachedInputs: string[] = []
        const uncachedIndices: number[] = []

        // Try to get embeddings from cache
        for (let i = 0; i < inputs.length; i++) {
            const input = inputs[i]
            const cachedEmbedding = await this.cache.get(input, config)

            if (cachedEmbedding) {
                embeddings[i] = cachedEmbedding
            } else {
                uncachedInputs.push(input)
                uncachedIndices.push(i)
            }
        }

        // If all embeddings were cached, return them
        if (uncachedInputs.length === 0) {
            return embeddings
        }

        // Get embeddings for uncached inputs
        let uncachedEmbeddings: number[][]

        if (provider.getBatchEmbeddings && uncachedInputs.length > 1) {
            // Use batch processing if available
            uncachedEmbeddings = await provider.getBatchEmbeddings(
                uncachedInputs,
                config
            )
        } else {
            // Fall back to sequential processing
            uncachedEmbeddings = []
            for (const input of uncachedInputs) {
                const embedding = await this.getEmbedding(input, config, areImages)
                uncachedEmbeddings.push(embedding)
            }
        }

        // Validate each embedding (without normalization)
        // get the expected dimensions from the provider 
        const expectedDimensions = getExpectedDimensions(config)

        const validatedEmbeddings = uncachedEmbeddings.map(
            (embedding, index) => {
                const validationResult = validateVector(
                    embedding,
                    expectedDimensions
                )
                if (!validationResult.isValid) {
                    throw new Error(
                        `Invalid embedding from ${config.provider} for input ${index}: ${validationResult.error}`
                    )
                }
                return embedding; // Return original embedding, not the normalized version
            }
        )

        // Cache the results if caching is enabled
        for (let i = 0; i < uncachedInputs.length; i++) {
            await this.cache.set(
                uncachedInputs[i],
                validatedEmbeddings[i],
                config
            )
        }

        // Merge cached and newly computed embeddings
        for (let i = 0; i < uncachedIndices.length; i++) {
            embeddings[uncachedIndices[i]] = validatedEmbeddings[i]
        }

        return embeddings
    }
}
