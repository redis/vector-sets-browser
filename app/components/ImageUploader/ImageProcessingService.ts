// Module references for lazy loading
let tf: any = null
let tfInitialized = false

/**
 * Converts a File object to a base64 string
 */
export const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = (error) => reject(error)
    })
}

/**
 * Ensure TensorFlow.js is loaded and initialized
 */
export const ensureTensorFlowLoaded = async (): Promise<any> => {
    if (!tf) {
        console.log("Dynamically importing TensorFlow.js")
        tf = await import("@tensorflow/tfjs")

        if (!tfInitialized) {
            console.log("Initializing TensorFlow.js")
            await tf.ready()
            tfInitialized = true
        }
    }

    // Prefer WebGL if available
    if (tf.getBackend() !== "webgl" && tf.ENV.getBool("HAS_WEBGL")) {
        console.log("Setting backend to WebGL")
        await tf.setBackend("webgl")
    }

    console.log(`Using TensorFlow backend: ${tf.getBackend()}`)
    return tf
}

/**
 * Preprocess an image for model inference
 */
export const preprocessImage = async (imageData: string): Promise<any> => {
    try {
        const tf = await ensureTensorFlowLoaded()

        // MobileNet expects 224x224 images
        const inputSize = 224

        // Create an HTMLImageElement from the base64 data
        const image = new window.Image()
        const imagePromise = new Promise<HTMLImageElement>((resolve, reject) => {
            image.onload = () => resolve(image)
            image.onerror = (event) => reject(
                event instanceof Event ? event : new Error(String(event))
            )
        })

        // Remove data URL prefix if present
        const base64Data = imageData.startsWith("data:image")
            ? imageData
            : `data:image/jpeg;base64,${imageData}`

        // Set crossOrigin to anonymous to avoid CORS issues with data URLs
        image.crossOrigin = "anonymous"
        image.src = base64Data
        await imagePromise

        console.log("Image loaded successfully:", image.width, "x", image.height)

        // Create a tensor from the image
        const tensor = tf.browser.fromPixels(image)
        
        // Resize to the expected input size
        const resized = tf.image.resizeBilinear(tensor, [inputSize, inputSize])
        
        // Convert to float and normalize to [-1, 1]
        const normalized = resized
            .toFloat()
            .div(tf.scalar(127.5))
            .sub(tf.scalar(1))
        
        // Add batch dimension [1, height, width, channels]
        const batched = normalized.expandDims(0)

        // Clean up intermediate tensors
        tensor.dispose()
        resized.dispose()
        normalized.dispose()

        return batched
    } catch (error) {
        console.error("Error preprocessing image:", error)
        throw error
    }
} 