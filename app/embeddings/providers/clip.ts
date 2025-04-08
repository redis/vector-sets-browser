import { EmbeddingConfig, getModelData, CLIP_MODELS } from "../types/embeddingModels"
import { EmbeddingProvider } from "./base"
import { AutoProcessor, AutoTokenizer, CLIPTextModelWithProjection, CLIPVisionModelWithProjection, RawImage } from '@xenova/transformers'

export class CLIPProvider implements EmbeddingProvider {
    private imageProcessor: any = null
    private visionModel: any = null
    private textModel: any = null
    private tokenizer: any = null
    
    async getImageEmbedding(imageData: string, modelPath: string): Promise<number[]> {
        try {
            // Initialize the image models if not already done
            if (!this.imageProcessor || !this.visionModel) {
                this.imageProcessor = await AutoProcessor.from_pretrained(modelPath)
                this.visionModel = await CLIPVisionModelWithProjection.from_pretrained(modelPath, {
                    quantized: true
                })
            }

            // Convert base64 to blob
            const response = await fetch(imageData)
            const blob = await response.blob()

            // Create a File object from the blob
            const file = new File([blob], 'image.jpg', { type: blob.type })

            // Create an object URL for the file
            const objectUrl = URL.createObjectURL(file)

            try {
                // Process the image
                const image = await RawImage.read(objectUrl)
                const imageInputs = await this.imageProcessor(image)
                const { image_embeds } = await this.visionModel(imageInputs)
                return Array.from(image_embeds.data)
            } finally {
                // Clean up the object URL
                URL.revokeObjectURL(objectUrl)
            }
        } catch (error) {
            console.error("[CLIP] Error generating image embedding:", error)
            throw error
        }
    }

    async getEmbedding(input: string, config: EmbeddingConfig): Promise<number[]> {
        if (!config.clip) {
            throw new Error("CLIP configuration is missing")
        }

        try {
            const modelPath = config.clip.model 
                ? CLIP_MODELS[config.clip.model].modelPath 
                : 'Xenova/clip-vit-base-patch32'

            if (!modelPath) {
                throw new Error("Model path is undefined")
            }

            // Determine if input is base64 image data or text
            const isBase64Image = input.startsWith('data:image')
            
            let embedding: number[]
            if (isBase64Image) {
                embedding = await this.getImageEmbedding(input, modelPath)
            } else {
                // Initialize the text model and tokenizer if not already done
                if (!this.textModel || !this.tokenizer) {
                    this.tokenizer = await AutoTokenizer.from_pretrained(modelPath)
                    this.textModel = await CLIPTextModelWithProjection.from_pretrained(modelPath, {
                        quantized: true
                    })
                }

                // Process text input
                const textInputs = this.tokenizer([input], { 
                    padding: true, 
                    truncation: true 
                })
                const { text_embeds } = await this.textModel(textInputs)
                embedding = Array.from(text_embeds.data)
            }

            // Validate embedding dimensions
            const modelData = getModelData(config)
            const expectedDim = modelData?.dimensions
            if (expectedDim && embedding.length !== expectedDim) {
                throw new Error(
                    `Unexpected embedding dimension: got ${embedding.length}, expected ${expectedDim}`
                )
            }

            // Validate vector values
            if (embedding.some(v => typeof v !== 'number' || isNaN(v) || !isFinite(v))) {
                console.error("Invalid vector values:", embedding)
                throw new Error("Vector contains invalid values (NaN or Infinity)")
            }

            console.log("Generated embedding dimensions:", embedding.length)

            return embedding
        } catch (error) {
            console.error("[CLIP] Error generating embedding:", error)
            throw error
        }
    }

    // Batch processing is not yet supported for CLIP
    async getBatchEmbeddings(inputs: string[], config: EmbeddingConfig): Promise<number[][]> {
        const embeddings: number[][] = []
        for (const input of inputs) {
            const embedding = await this.getEmbedding(input, config)
            embeddings.push(embedding)
        }
        return embeddings
    }
} 