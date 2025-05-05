import { ImageConfig } from "@/lib/embeddings/types/embeddingModels"

// Module references for lazy loading
let tf: any = null
let mobilenetModule: any = null

// Cache for models to avoid reloading
const modelCache: Record<string, any> = {}
let isModelLoading = false
let tfInitialized = false

// Check if code is running in browser environment
const isBrowser = typeof window !== "undefined"

// Initialize canvas in non-browser environments
async function initializeCanvas() {
    if (!isBrowser) {
        try {
            // Dynamic import for node-canvas in server environment
            await import('canvas')
        } catch (error) {
            console.error("[TensorFlow.js] Failed to load canvas package:", error)
        }
    }
}

// Call initialization
initializeCanvas().catch(console.error)

// Don't try to load tfjs-node directly, as it causes webpack issues
// We'll use dynamic imports instead when needed

/**
 * Load a TensorFlow.js image model
 */
export async function loadImageModel(config: ImageConfig): Promise<any> {
    const modelName = config.model

    // Return cached model if available
    if (modelCache[modelName]) {
        return modelCache[modelName]
    }

    // Wait if model is already loading
    if (isModelLoading) {
        while (isModelLoading) {
            await new Promise((resolve) => setTimeout(resolve, 100))
        }
        if (modelCache[modelName]) {
            return modelCache[modelName]
        }
    }

    try {
        isModelLoading = true
        console.log(`[TensorFlow.js] Loading image model: ${modelName}`)

        // Lazy load TensorFlow.js and MobileNet
        if (!tf) {
            console.log("[TensorFlow.js] Dynamically importing TensorFlow.js")
            tf = await import("@tensorflow/tfjs")
        }

        if (!mobilenetModule) {
            console.log("[TensorFlow.js] Dynamically importing MobileNet")
            mobilenetModule = await import("@tensorflow-models/mobilenet")
        }

        // Initialize TensorFlow.js
        if (!tfInitialized) {
            console.log("[TensorFlow.js] Initializing TensorFlow.js")
            await tf.ready()
            tfInitialized = true
        }

        // Set the appropriate backend based on environment
        if (isBrowser) {
            // For browser, prefer WebGL if available
            if (tf.getBackend() !== "webgl" && tf.ENV.getBool("HAS_WEBGL")) {
                console.log(
                    "[TensorFlow.js] Setting backend to WebGL for client-side processing"
                )
                await tf.setBackend("webgl")
            }
        } else {
            // Server-side processing is not supported
            throw new Error(
                "Image processing in server components is not supported. " +
                "Please use client components for image processing."
            )
        }

        console.log(`[TensorFlow.js] Using backend: ${tf.getBackend()}`)

        // For now, we only support MobileNet
        // Use version 1 with alpha 1.0 for best compatibility
        const model = await mobilenetModule.load({
            version: 1,
            alpha: 1.0,
        })

        // Cache the model
        modelCache[modelName] = model

        console.log(`[TensorFlow.js] Image model loaded: ${modelName}`)
        return model
    } catch (error) {
        console.error(
            `[TensorFlow.js] Error loading image model: ${modelName}`,
            error
        )
        throw error
    } finally {
        isModelLoading = false
    }
}

/**
 * Preprocess an image for the model
 */
export async function preprocessImage(
    imageData: string,
): Promise<any> {
    try {
        // Ensure TensorFlow.js is loaded
        if (!tf) {
            console.log(
                "[TensorFlow.js] Dynamically importing TensorFlow.js for preprocessing"
            )
            tf = await import("@tensorflow/tfjs")

            if (!tfInitialized) {
                console.log("[TensorFlow.js] Initializing TensorFlow.js")
                await tf.ready()
                tfInitialized = true
            }
        }

        // MobileNet expects 224x224 images
        const inputSize = 224

        if (!isBrowser) {
            // Server-side processing is not supported
            throw new Error(
                "Image processing in server components is not supported. " +
                "Please use client components for image processing."
            )
        }

        // Remove data URL prefix if present for processing
        const base64Data = imageData.startsWith("data:image")
            ? imageData
            : `data:image/jpeg;base64,${imageData}`

        // Client-side processing using browser APIs
        // Create an HTMLImageElement from the base64 data
        const image = new window.Image()
        const imagePromise = new Promise<HTMLImageElement>(
            (resolve, reject) => {
                image.onload = () => resolve(image)
                image.onerror = (err) => {
                    console.error("[TensorFlow.js] Error loading image:", err);
                    reject(err);
                }
            }
        )

        // Set crossOrigin to anonymous to avoid CORS issues with data URLs
        image.crossOrigin = "anonymous"
        image.src = base64Data

        try {
            await imagePromise

            console.log(
                "[TensorFlow.js] Image loaded successfully:",
                image.width,
                "x",
                image.height
            )

            // Create a tensor from the image
            const tensor = tf.browser.fromPixels(image)
            console.log(
                "[TensorFlow.js] Image tensor created with shape:",
                tensor.shape
            )

            // Resize to the expected input size
            const resized = tf.image.resizeBilinear(tensor, [inputSize, inputSize])
            console.log("[TensorFlow.js] Image resized to:", resized.shape)

            // Convert to float and normalize to [-1, 1]
            const normalized = resized
                .toFloat()
                .div(tf.scalar(127.5))
                .sub(tf.scalar(1))
            console.log(
                "[TensorFlow.js] Image normalized with shape:",
                normalized.shape
            )

            // Clean up intermediate tensors
            tensor.dispose()
            resized.dispose()

            return normalized
        } catch (error) {
            console.error("[TensorFlow.js] Error processing image:", error);

            // Fallback: create an empty tensor with the right dimensions
            // This ensures we don't crash the app even if image processing fails
            console.log("[TensorFlow.js] Creating fallback tensor");
            const fallbackTensor = tf.zeros([inputSize, inputSize, 3]);
            return fallbackTensor;
        }
    } catch (error) {
        console.error("[TensorFlow.js] Error preprocessing image:", error)
        throw error
    }
}

/**
 * Get embedding for an image using TensorFlow.js
 */
export async function getImageEmbedding(
    imageData: string,
    config: ImageConfig
): Promise<number[]> {
    try {
        console.log("[TensorFlow.js] Starting image embedding generation")

        // Load the model
        const model = await loadImageModel(config)

        // Preprocess the image
        const tensor = await preprocessImage(imageData)

        console.log(
            "[TensorFlow.js] Generating embedding with model:",
            config.model
        )

        // Get the internal model to access the penultimate layer
        // @ts-ignore - accessing internal property
        const internalModel = model.model

        // Add batch dimension [1, height, width, channels]
        const batchedTensor = tensor.expandDims(0);
        console.log("[TensorFlow.js] Added batch dimension, new shape:", batchedTensor.shape);

        // Execute the model up to the penultimate layer
        // This gives us the feature vector (embedding) before classification
        let activationLayer;

        try {
            console.log("[TensorFlow.js] Attempting to execute model with layer name 'global_average_pooling2d_1'");
            // Try first with the expected layer name
            activationLayer = internalModel.execute(
                batchedTensor,
                ["global_average_pooling2d_1"] // This is the name of the penultimate layer in MobileNet v1
            );
        } catch (_e) {
            console.log("[TensorFlow.js] First layer name failed, trying alternate layer name 'global_average_pooling2d'");
            try {
                // Try alternate layer name
                activationLayer = internalModel.execute(
                    batchedTensor,
                    ["global_average_pooling2d"]
                );
            } catch (_e2) {
                console.log("[TensorFlow.js] Both layer names failed, using model.infer() method");
                // If both specific layers fail, use model's infer method
                activationLayer = model.infer(batchedTensor, true);
            }
        }

        // Debug the tensor shape and values
        console.log(
            "[TensorFlow.js] Embedding tensor shape:",
            activationLayer.shape
        )

        // Convert to array
        const rawData = await activationLayer.data();
        const embedding = Array.from(rawData).map(val => Number(val));

        // Debug the embedding
        console.log(
            "[TensorFlow.js] Embedding sample (first 10 values):",
            embedding.slice(0, 10)
        )
        console.log("[TensorFlow.js] Embedding length:", embedding.length)
        console.log(
            "[TensorFlow.js] Embedding has zeros:",
            embedding.filter((v) => v === 0).length
        )

        // Clean up the tensors
        tensor.dispose()
        batchedTensor.dispose()
        activationLayer.dispose()

        return embedding
    } catch (error) {
        console.error(
            "[TensorFlow.js] Error generating image embedding:",
            error
        )
        throw error
    }
}
