import { NextRequest, NextResponse } from "next/server"
import { EmbeddingConfig, getModelData } from "@/app/types/embedding"
import { validateAndNormalizeVector } from "@/app/utils/vectorValidation"
import { cookies } from "next/headers"
import { RedisClient } from "@/app/lib/server/redis-client"
import { getImageEmbedding } from "@/app/utils/imageEmbedding"
import path from "path"
import fs from "fs/promises"

// Initialize TensorFlow.js
type UniversalSentenceEncoderModel = {
    embed: (inputs: string[]) => Promise<any>
}

// Module references for lazy loading
let tf: any = null
let use: any = null
let useModel: UniversalSentenceEncoderModel | null = null
let useModelLoading = false
let tfInitialized = false

const REDIS_URL_COOKIE = "redis_url"
const EMBEDDING_CACHE_KEY = "embeddingCache"
const EMBEDDING_CACHE_LOG_KEY = "embeddingCache:log"

// Helper to get Redis URL from cookies
function getRedisUrl(): string | null {
    const url = cookies().get(REDIS_URL_COOKIE)?.value
    return url || null
}

// Generate a hash field based on provider, model, and input
function generateHashField(input: string, config: EmbeddingConfig): string {
    const modelIdentifier =
        config.provider === "openai"
            ? config.openai?.model
            : config.provider === "tensorflow"
            ? config.tensorflow?.model
            : config.provider === "ollama"
            ? config.ollama?.modelName
            : config.provider === "image"
            ? config.image?.model
            : ""

    // Create a deterministic hash of the input to avoid field name length issues
    // and special character issues in Redis
    const inputHash = Buffer.from(input).toString("base64").substring(0, 40)
    return `${config.provider}:${modelIdentifier}:${inputHash}`
}

async function getCachedEmbedding(
    input: string,
    config: EmbeddingConfig
): Promise<number[] | null> {
    try {
        const url = getRedisUrl()
        if (!url) {
            return null
        }

        return await RedisClient.withConnection(url, async (client) => {
            const field = generateHashField(input, config)
            const cached = await client.hGet(EMBEDDING_CACHE_KEY, field)

            if (cached) {
                // Update access time in sorted set
                await client.zAdd(EMBEDDING_CACHE_LOG_KEY, {
                    score: Date.now(),
                    value: field
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

async function setCachedEmbedding(
    input: string,
    embedding: number[],
    config: EmbeddingConfig
): Promise<void> {
    try {
        const url = getRedisUrl()
        if (!url) {
            return
        }

        const field = generateHashField(input, config)

        await RedisClient.withConnection(url, async (client) => {
            // Store the embedding in the hash
            await client.hSet(
                EMBEDDING_CACHE_KEY,
                field,
                JSON.stringify(embedding)
            )

            // Update access time in sorted set
            await client.zAdd(EMBEDDING_CACHE_LOG_KEY, {
                score: Date.now(),
                value: field
            })

            return true
        })
    } catch (error) {
        console.error("[Embedding] Cache write error:", error)
    }
}

// Load TensorFlow.js model
async function loadTensorFlowModel(
    modelName: string
): Promise<UniversalSentenceEncoderModel> {
    if (useModel) return useModel

    if (useModelLoading) {
        // Wait for the model to finish loading
        while (useModelLoading) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        if (!useModel) {
            throw new Error("TensorFlow.js model failed to load")
        }
        return useModel
    }

    try {
        useModelLoading = true
        console.log(`[Embedding] Loading TensorFlow.js model: ${modelName}`)

        // Lazy load TensorFlow.js and Universal Sentence Encoder
        if (!tf) {
            console.log("[Embedding] Dynamically importing TensorFlow.js")
            tf = await import("@tensorflow/tfjs")
        }

        if (!use) {
            console.log(
                "[Embedding] Dynamically importing Universal Sentence Encoder"
            )
            use = await import("@tensorflow-models/universal-sentence-encoder")
        }

        // Ensure TensorFlow.js is initialized
        if (!tfInitialized) {
            console.log("[Embedding] Initializing TensorFlow.js")
            await tf.ready()
            tfInitialized = true
        }

        // Load the Universal Sentence Encoder model
        useModel =
            (await use.load()) as unknown as UniversalSentenceEncoderModel
        console.log("[Embedding] TensorFlow.js model loaded successfully")
        if (!useModel) {
            throw new Error("TensorFlow.js model failed to load")
        }
        return useModel
    } catch (error) {
        console.error("[Embedding] Error loading TensorFlow.js model:", error)
        throw error
    } finally {
        useModelLoading = false
    }
}

async function getTensorFlowEmbedding(
    text: string,
    config: EmbeddingConfig
): Promise<number[]> {
    if (!config.tensorflow) {
        throw new Error("TensorFlow.js configuration is missing")
    }

    console.log(
        `[Embedding] Getting TensorFlow.js embedding with model: ${config.tensorflow.model}`
    )

    try {
        // Load the model
        const model = await loadTensorFlowModel(config.tensorflow.model)

        // Get embeddings
        const embeddings = await model.embed([text])

        // Convert to array and validate
        const embeddingsArray = await embeddings.arraySync()
        const rawEmbedding = embeddingsArray[0]
        
        // Use our validation utility to normalize and validate the vector
        const validationResult = validateAndNormalizeVector(
            rawEmbedding,
            "tensorflow"
        )

        if (!validationResult.isValid) {
            throw new Error(
                `Invalid TensorFlow.js embedding: ${validationResult.error}`
            )
        }

        return validationResult.vector
    } catch (error) {
        console.error("[Embedding] TensorFlow.js embedding error:", error)
        throw error
    }
}

async function getImageModelEmbedding(
    imageData: string,
    config: EmbeddingConfig
): Promise<number[]> {
    if (!config.image) {
        throw new Error("Image configuration is missing")
    }

    console.log(
        `[Embedding] Getting image embedding with model: ${config.image.model}`
    )

    try {
        // Get the embedding using our image embedding utility
        const embedding = await getImageEmbedding(imageData, config.image)

        // Validate embedding dimensions
        const modelData = getModelData(config)
        const expectedDim = modelData?.dimensions
        if (embedding.length !== expectedDim) {
            throw new Error(
                `Unexpected image embedding dimension: got ${embedding.length}, expected ${expectedDim}`
            )
        }

        return embedding
    } catch (error) {
        console.error("[Embedding] Image embedding error:", error)

        // Provide a clear error message for server-side image processing
        if (
            error instanceof Error &&
            (error.message.includes("Image is not defined") ||
                error.message.includes(
                    "Image processing in server components is not supported"
                ))
        ) {
            throw new Error(
                "Image processing cannot be performed in server components. " +
                    "Please use a client component for image processing."
            )
        }

        throw error
    }
}

async function getOllamaEmbedding(
    input: string,
    config: EmbeddingConfig
): Promise<number[]> {
    if (!config.ollama) {
        throw new Error("Ollama configuration is missing")
    }

    const prompt =
        config.ollama.promptTemplate?.replace("{text}", input) || input

    console.log(
        `[Embedding] Calling Ollama API at ${config.ollama.apiUrl} with model ${config.ollama.modelName}`
    )

    const response = await fetch(config.ollama.apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            model: config.ollama.modelName,
            prompt,
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`)
    }
    const data = await response.json()

    // Validate and normalize the Ollama embedding
    const validationResult = validateAndNormalizeVector(
        data.embedding,
        "ollama"
    )

    if (!validationResult.isValid) {
        throw new Error(`Invalid Ollama embedding: ${validationResult.error}`)
    }

    return validationResult.vector
}

async function getOpenAIEmbedding(
    input: string,
    config: EmbeddingConfig
): Promise<number[]> {
    if (!config.openai) {
        throw new Error("OpenAI configuration is missing")
    }

    const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.openai.apiKey}`,
            "OpenAI-Organization": process.env.OPENAI_ORG_ID || "",
        },
        body: JSON.stringify({
            input: input,
            model: config.openai.model,
            encoding_format: "float",
        }),
    })

    if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const embedding = data.data[0].embedding

    // Validate embedding dimensions
    const modelData = getModelData(config)
    const expectedDim = modelData?.dimensions
    if (embedding.length !== expectedDim) {
        throw new Error(
            `Unexpected embedding dimension: got ${embedding.length}, expected ${expectedDim}`
        )
    }

    return embedding
}

async function getEmbedding(
    input: string,
    config: EmbeddingConfig,
    isImage: boolean = false
): Promise<number[]> {
    if (isImage) {
        console.log(
            `[Embedding] Getting embedding for image data using provider: ${config.provider}`
        )
    } else {
        console.log(
            `[Embedding] Getting embedding for text (${input.length} chars) using provider: ${config.provider}`
        )
    }

    if (config.provider === "none") {
        throw new Error("No embedding provider configured")
    }

    // Check cache first for all providers
    const cached = await getCachedEmbedding(input, config)
    if (cached) {
        console.log("[Embedding] Cache hit - returning cached embedding")
        return cached
    }

    let embedding: number[];

    if (config.provider === "image") {
        if (!isImage) {
            throw new Error("Image provider requires image data")
        }
        embedding = await getImageModelEmbedding(input, config)
    } else if (isImage) {
        throw new Error(
            `Provider ${config.provider} does not support image data`
        )
    } else {
        switch (config.provider) {
            case "ollama":
                embedding = await getOllamaEmbedding(input, config)
                break
            case "openai":
                embedding = await getOpenAIEmbedding(input, config)
                break
            case "tensorflow":
                embedding = await getTensorFlowEmbedding(input, config)
                break
            default:
                throw new Error(`Unsupported provider: ${config.provider}`)
        }
    }

    // Cache the result for all providers
    await setCachedEmbedding(input, embedding, config)
    return embedding
}

export async function POST(request: NextRequest) {
    const startTime = Date.now()
    try {
        const { text, imageData, config } = await request.json()

        // Determine if we're processing text or image
        const isImage = !!imageData
        let input = isImage ? imageData : text

        if (isImage) {
            console.log(
                `[Embedding] Received request with image data:`,
                imageData
            )
            // If imageData is a path starting with /, load it from public directory
            if (typeof imageData === "string" && imageData.startsWith("/")) {
                const publicPath = path.join(process.cwd(), "public", imageData)
                console.log(
                    `[Embedding] Loading image from public path:`,
                    publicPath
                )
                const imageBuffer = await fs.readFile(publicPath)
                input = `data:image/png;base64,${imageBuffer.toString(
                    "base64"
                )}`
            }
        } else {
            console.log(
                `[Embedding] Received request with text length: ${
                    text?.length || 0
                }`
            )
        }

        if ((!text && !imageData) || !config) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Missing required fields (text or imageData, and config)",
                },
                { status: 400 }
            )
        }

        const embedding = await getEmbedding(input, config, isImage)
        const duration = Date.now() - startTime
        console.log(`[Embedding] Request completed in ⏱️ ${duration}ms`)
        return NextResponse.json({ success: true, result: embedding })
    } catch (error) {
        const duration = Date.now() - startTime
        console.error(
            `[Embedding] Error getting embedding (${duration}ms):`,
            error
        )
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Unknown error",
            },
            { status: 500 }
        )
    }
} 