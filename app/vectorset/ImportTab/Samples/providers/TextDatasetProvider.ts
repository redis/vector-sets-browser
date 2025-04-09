import { ImportJobConfig } from "@/app/api/jobs"
import { EmbeddingConfig, isTextEmbedding } from "@/app/embeddings/types/embeddingModels"
import { Dataset, DatasetMetadata, DatasetProvider } from "../types/DatasetProvider"

export interface TextDatasetConfig extends DatasetMetadata {
    fileUrl: string
    columns: string[]
    elementTemplate: string
    vectorTemplate: string
    attributeColumns: string[]
    delimiter?: string
    hasHeader?: boolean
    skipRows?: number
}

export class TextDataset implements Dataset {
    private config: TextDatasetConfig

    constructor(config: TextDatasetConfig) {
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
            delimiter: this.config.delimiter || ",",
            hasHeader: this.config.hasHeader ?? true,
            skipRows: this.config.skipRows ?? 0,
            elementColumn: this.config.columns[0],
            textColumn: this.config.columns[0],
            elementTemplate: this.config.elementTemplate,
            textTemplate: this.config.vectorTemplate,
            attributeColumns: this.config.attributeColumns,
            fileType: "csv"
        }
    }

    async prepareImport(): Promise<{ file: File, config: ImportJobConfig }> {
        // Fetch the CSV file
        const response = await fetch(this.config.fileUrl)
        if (!response.ok) {
            throw new Error(`Failed to fetch dataset: ${response.statusText}`)
        }

        // Convert to blob and create file
        const csvBlob = await response.blob()
        const file = new File(
            [csvBlob],
            `${this.config.name.toLowerCase().replace(/\s+/g, "-")}.csv`,
            { type: "text/csv" }
        )

        // Get import config
        const config = await this.getImportConfig()

        return { file, config }
    }

    validateEmbedding(config: EmbeddingConfig): boolean {
        return isTextEmbedding(config)
    }
}

export class TextDatasetProvider implements DatasetProvider {
    private datasets: TextDatasetConfig[]

    constructor(datasets: TextDatasetConfig[]) {
        this.datasets = datasets
    }

    getDatasets(): Dataset[] {
        return this.datasets.map(config => new TextDataset(config))
    }

    createDataset(metadata: TextDatasetConfig): Dataset {
        return new TextDataset(metadata)
    }
} 