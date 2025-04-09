import { ImportJobConfig } from "@/app/api/jobs"
import { EmbeddingConfig, isImageEmbedding } from "@/app/embeddings/types/embeddingModels"
import { getImageEmbedding } from "@/app/utils/imageEmbedding"
import { Dataset, DatasetMetadata, DatasetProvider, ImportProgress } from "../types/DatasetProvider"

export interface ImageDatasetConfig extends DatasetMetadata {
    baseUrl: string
    classesFile: string
    attributeColumns: string[]
    elementTemplate: string
}

export class ImageDataset implements Dataset {
    private config: ImageDatasetConfig

    constructor(config: ImageDatasetConfig) {
        this.config = config
    }

    // Implement Dataset interface properties
    get name() { return this.config.name }
    get description() { return this.config.description }
    get icon() { return this.config.icon }
    get recordCount() { return this.config.recordCount }
    get dataType() { return this.config.dataType }
    get embeddingType() { return this.config.embeddingType }
    get recommendedEmbedding() { return this.config.recommendedEmbedding }
    get previewComponent() { return this.config.previewComponent }

    async getImportConfig(): Promise<ImportJobConfig> {
        return {
            delimiter: ",",
            hasHeader: false,
            skipRows: 0,
            elementColumn: "image",
            textColumn: "image",
            elementTemplate: this.config.elementTemplate,
            attributeColumns: this.config.attributeColumns,
            fileType: "images"
        }
    }

    private async getImageList(count?: number): Promise<string[]> {
        const response = await fetch(this.config.classesFile)
        if (!response.ok) {
            throw new Error(`Failed to fetch image classes: ${response.statusText}`)
        }

        const text = await response.text()
        const lines = text.split("\n").filter(line => line.trim().length > 0)
        const startIdx = lines[0].startsWith("filename") ? 1 : 0
        const imageList = lines.slice(startIdx).map(line => line.split(",")[0])

        return count ? imageList.slice(0, count) : imageList
    }

    async prepareImport({ count = 5, onProgress }: { count?: number, onProgress?: (progress: ImportProgress) => void } = {}): Promise<{ file: File, config: ImportJobConfig }> {
        // Get list of images to process
        const imageList = await this.getImageList(count)
        const embeddings: number[][] = []

        // Process each image
        for (let i = 0; i < imageList.length; i++) {
            const filename = imageList[i]
            const imageUrl = `${this.config.baseUrl}/${filename}`

            try {
                // Fetch image
                const response = await fetch(imageUrl)
                if (!response.ok) {
                    console.warn(`Could not fetch ${imageUrl}, skipping`)
                    continue
                }

                // Convert to base64
                const imageBlob = await response.blob()
                const reader = new FileReader()
                const imageData = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string)
                    reader.readAsDataURL(imageBlob)
                })

                // Generate embedding
                const embedding = await getImageEmbedding(imageData, { model: "mobilenet" })
                embeddings.push(embedding)

                // Update progress
                onProgress?.({
                    current: i + 1,
                    total: imageList.length,
                    status: `Processing image ${i + 1} of ${imageList.length}`
                })
            } catch (error) {
                console.error(`Error processing image ${filename}:`, error)
                continue
            }
        }

        // Create a sample image file for the import job
        const sampleImageResponse = await fetch(`${this.config.baseUrl}/${imageList[0]}`)
        const sampleImageBlob = await sampleImageResponse.blob()
        const file = new File(
            [sampleImageBlob],
            `${this.name.toLowerCase().replace(/\s+/g, "-")}_${count}_images.jpg`,
            { type: "image/jpeg" }
        )

        // Get base config and add embeddings
        const config = await this.getImportConfig()
        config.rawVectors = embeddings

        return { file, config }
    }

    validateEmbedding(config: EmbeddingConfig): boolean {
        return isImageEmbedding(config)
    }
}

export class ImageDatasetProvider implements DatasetProvider {
    private datasets: ImageDatasetConfig[]

    constructor(datasets: ImageDatasetConfig[]) {
        this.datasets = datasets
    }

    getDatasets(): Dataset[] {
        return this.datasets.map(config => new ImageDataset(config))
    }

    createDataset(metadata: ImageDatasetConfig): Dataset {
        return new ImageDataset(metadata)
    }
} 