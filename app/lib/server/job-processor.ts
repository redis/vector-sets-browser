import {
    CSVJobMetadata,
    getJobStatusKey,
    JobProgress,
    CSVRow,
} from "@/app/types/job-queue"
import { JobQueueService } from "./job-queue"
import { RedisConnection } from "@/app/redis-server/RedisConnection"
import { registerCompletedJob } from "@/app/api/jobs/completed/route"
import { buildVectorElement, saveVectorData } from "@/app/lib/importUtils"

export class JobProcessor {
    private url: string
    private jobId: string
    private isRunning: boolean = false
    private isPaused: boolean = false
    private metadata: CSVJobMetadata | null = null
    private _vectorElements: ReturnType<typeof buildVectorElement>[] = []

    constructor(url: string, jobId: string) {
        this.url = url
        this.jobId = jobId
    }

    private async getEmbedding(text: string): Promise<number[]> {
        if (!this.metadata) {
            throw new Error("Job metadata not loaded")
        }

        if (!text) {
            throw new Error("Text to embed is undefined or empty")
        }

        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
        const response = await fetch(`${baseUrl}/api/embeddings`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text,
                config: this.metadata.embedding,
            }),
        })

        if (!response.ok) {
            console.error(
                "[JobProcessor] Failed to get embedding for text:",
                text.substring(0, 40) + "..."
            )
            throw new Error(`Failed to get embedding: ${text.substring(0, 10)}..., ${response.statusText}`)
        }

        const data = await response.json()
        if (!data.success) {
            console.error("[JobProcessor] Failed to get embedding:", data.error)
            throw new Error(`Failed to get embedding: ${data.error}`)
        }

        if (!Array.isArray(data.result)) {
            console.error("[JobProcessor] Invalid embedding response:", data)
            throw new Error(
                "Invalid response from embedding API: expected array"
            )
        }

        return data.result
    }

    private async updateProgress(
        progress: Partial<JobProgress>
    ): Promise<void> {
        try {
            // Use the JobQueueService's implementation to update progress
            // This provides a single consistent implementation and avoids duplication
            await JobQueueService.updateJobProgress(
                this.url,
                this.jobId,
                progress
            );

            // If there was a status change, try to emit an event and register for client notification
            if (progress.status && this.metadata?.vectorSetName) {
                // Register status change for client notification via completed jobs API
                if (progress.status === "completed" || progress.status === "failed" || progress.status === "cancelled") {
                    registerCompletedJob(this.jobId, this.metadata.vectorSetName)
                }
            }
        } catch (error) {
            console.error(
                `Error updating progress for job ${this.jobId}:`,
                error
            )
        }
    }

    private async addToRedis(
        element: string,
        embedding: number[],
        attributes?: Record<string, string>
    ): Promise<void> {
        if (!this.metadata) {
            throw new Error("Job metadata not loaded")
        }

        // Prepare the command
        const command = [
            "VADD",
            this.metadata.vectorSetName,
            "VALUES",
            String(embedding.length),
            ...embedding.map(String),
            element,
        ]

        // Add attributes if they exist
        if (attributes && Object.keys(attributes).length > 0) {
            command.push("SETATTR")

            // Convert attributes to JSON string
            const attributesJson = JSON.stringify(attributes)
            command.push(attributesJson)
        }

        const result = await RedisConnection.withClient(
            this.url,
            async (client) => {
                await client.sendCommand(command)
                return true
            }
        )

        if (!result.success) {
            console.error(
                `[JobProcessor] Failed to add vector to Redis:`,
                result.error
            )
            throw new Error(`Failed to add vector to Redis: ${result.error}`)
        }
    }

    private processTemplate(template: string, rowData: CSVRow): string {
        // Replace ${columnName} with the actual value from rowData
        return template.replace(/\${([^}]+)}/g, (match, columnName) => {
            return rowData[columnName] !== undefined
                ? rowData[columnName]
                : match
        });
    }

    private async processToJson(
        elementId: string,
        embedding: number[],
        attributes?: Record<string, string>
    ): Promise<void> {
        if (!this.metadata) {
            throw new Error("Job metadata not loaded")
        }

        const vectorElement = buildVectorElement(elementId, embedding, attributes)

        // Store the vector element in memory until we're ready to save
        if (!this._vectorElements) {
            this._vectorElements = []
        }
        this._vectorElements.push(vectorElement)

    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            return
        }

        this.isRunning = true
        this.isPaused = false
        this.metadata = await JobQueueService.getJobMetadata(
            this.url,
            this.jobId
        )

        if (!this.metadata) {
            console.error(
                `[JobProcessor] No metadata found for job ${this.jobId}`
            )
            throw new Error("Job metadata not found")
        }

        await this.updateProgress({
            status: "processing",
            message: "Processing started",
        })

        try {
            while (this.isRunning) {
                // Check if job is paused
                if (this.isPaused) {

                    // Check if job was cancelled while paused
                    const progress = await JobQueueService.getJobProgress(
                        this.url,
                        this.jobId
                    )
                    if (!progress || progress.status === "cancelled") {
                        this.isRunning = false
                        break
                    }

                    await new Promise((resolve) => setTimeout(resolve, 1000))
                    continue
                }

                const item = await JobQueueService.getNextQueueItem(
                    this.url,
                    this.jobId
                )
                if (!item) {
                    // If this was a JSON export job, save the collected vectors
                    if (this.metadata.exportType === 'json' && this.metadata.outputFilename) {
                        try {
                            console.log(`[JobProcessor] Starting JSON export of ${this._vectorElements.length} vectors to ${this.metadata.outputFilename}`)
                            const result = await saveVectorData(this.metadata.outputFilename, this._vectorElements)
                            console.log(`[JobProcessor] Successfully saved vectors to ${result.filePath}`)

                            // Update the progress with the file location
                            await this.updateProgress({
                                status: "completed",
                                message: `Export completed. File saved to ${result.filePath}`,
                            })
                        } catch (error) {
                            console.error(`[JobProcessor] Failed to save vectors to JSON:`, error)
                            await this.updateProgress({
                                status: "failed",
                                error: error instanceof Error ? error.message : String(error),
                                message: `Failed to save vectors to JSON: ${error instanceof Error ? error.message : String(error)}`,
                            })
                            throw error
                        }
                    } else {
                        await this.updateProgress({
                            status: "completed",
                            message: "Processing completed",
                        })
                    }

                    // Create an import log entry before cleaning up the job
                    await this.createImportLogEntry()

                    // Notify about the import completing
                    if (this.metadata?.vectorSetName) {
                        // Register the completed job for client polling
                        registerCompletedJob(this.jobId, this.metadata.vectorSetName)
                    }

                    // Clean up the job data from Redis
                    await JobQueueService.cleanupJob(this.url, this.jobId)

                    break
                }

                // Check if job status exists and if the job itself still exists
                const statusExists = await RedisConnection.withClient(
                    this.url,
                    async (client) => {
                        const statusKey = getJobStatusKey(this.jobId)
                        return await client.exists(statusKey)
                    }
                )

                if (!statusExists) {
                    this.isRunning = false
                    break
                }

                // Check if job metadata still exists
                const jobMetadata = await JobQueueService.getJobMetadata(
                    this.url,
                    this.jobId
                )

                // If status exists but job metadata doesn't, clean up the orphaned status key
                if (!jobMetadata) {
                    console.log(
                        `[JobProcessor] Job ${this.jobId} metadata no longer exists but status does, cleaning up orphaned status`
                    )
                    await RedisConnection.withClient(
                        this.url,
                        async (client) => {
                            const statusKey = getJobStatusKey(this.jobId)
                            await client.del(statusKey)
                        }
                    )
                    this.isRunning = false
                    break
                }

                // Check if job was cancelled or paused
                const progress = await JobQueueService.getJobProgress(
                    this.url,
                    this.jobId
                )
                if (!progress) {
                    this.isRunning = false
                    break
                }

                if (progress.status === "cancelled") {
                    this.isRunning = false
                    break
                } else if (progress.status === "paused") {
                    this.isPaused = true
                    continue
                }

                try {
                    let elementId: string
                    let textToEmbed: string
                    let embedding: number[] | undefined

                    // Handle pre-computed vectors from JSON or image files
                    if (this.metadata.fileType === 'json' || this.metadata.fileType === 'image' || this.metadata.fileType === 'images') {
                        // Check if we have a pre-computed vector
                        if ((item.rowData as any)._vector) {
                            embedding = (item.rowData as any)._vector
                        }
                    }

                    // Get the element identifier - either from template or column
                    if (this.metadata.elementTemplate) {
                        elementId = this.processTemplate(
                            this.metadata.elementTemplate,
                            item.rowData
                        )
                    } else {
                        // Get the element identifier from the configured column
                        const elementColumn =
                            this.metadata.elementColumn || "id" // Default to "id" for JSON files
                        elementId = item.rowData[elementColumn]
                    }

                    if (!elementId) {
                        console.warn(
                            `[JobProcessor] Skipping item ${item.index + 1
                            }: Element identifier not found`
                        )
                        await this.updateProgress({
                            current: item.index + 1,
                            message: `Skipped item ${item.index + 1
                                }: Missing element identifier`,
                        })
                        continue
                    }

                    // For files without pre-computed vectors
                    if (!embedding) {
                        // Get the text to embed - either from template or column
                        if (this.metadata.textTemplate) {
                            textToEmbed = this.processTemplate(
                                this.metadata.textTemplate,
                                item.rowData
                            )
                        } else {
                            // Get the text to embed from the configured column
                            const textColumn =
                                this.metadata.textColumn || "text" // Default to "text" for JSON files
                            textToEmbed = item.rowData[textColumn]
                        }

                        if (!textToEmbed) {
                            console.warn(
                                `[JobProcessor] Skipping item ${item.index + 1
                                }: Text to embed not found`
                            )
                            await this.updateProgress({
                                current: item.index + 1,
                                message: `Skipped item ${item.index + 1
                                    }: Missing text to embed`,
                            })
                            continue
                        }

                        embedding = await this.getEmbedding(textToEmbed)
                    }

                    // Extract attributes if attribute columns are configured
                    const attributes: Record<string, string> = {}
                    if (
                        this.metadata.attributeColumns &&
                        this.metadata.attributeColumns.length > 0
                    ) {
                        for (const column of this.metadata.attributeColumns) {
                            if (item.rowData[column] !== undefined) {
                                attributes[column] = item.rowData[column]
                            }
                        }
                        console.log(
                            `[JobProcessor] Extracted attributes:`,
                            attributes
                        )
                    }

                    // Choose between Redis and JSON export
                    if (this.metadata.exportType === 'json') {
                        console.log(`[JobProcessor] Exporting to JSON: ${elementId}`)
                        await this.processToJson(elementId, embedding, Object.keys(attributes).length > 0 ? attributes : undefined)
                    } else {
                        console.log(`[JobProcessor] Adding to Redis: ${elementId}`)
                        await this.addToRedis(elementId, embedding, Object.keys(attributes).length > 0 ? attributes : undefined)
                    }

                    // Update progress
                    await this.updateProgress({
                        current: item.index + 1,
                        message: `Processed item ${item.index + 1}`,
                    })
                } catch (error) {
                    const errorMessage =
                        error instanceof Error ? error.message : String(error)
                    console.error(
                        `[JobProcessor] Error processing item ${item.index + 1
                        }:`,
                        error
                    )
                    await this.updateProgress({
                        current: item.index + 1,
                        message: `Error processing item ${item.index + 1
                            }: ${errorMessage}`,
                    })
                    // Continue with next item after error
                    await new Promise((resolve) => setTimeout(resolve, 1000))
                }
            }
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error)
            console.error(`[JobProcessor] Job processing error:`, error)
            await this.updateProgress({
                status: "failed",
                error: errorMessage,
                message: `Job failed: ${errorMessage}`,
            })
        } finally {
            // Clear the vector elements array
            this._vectorElements = []
            console.log(`[JobProcessor] Job ${this.jobId} finished`)
            this.isRunning = false
        }
    }

    public async pause(): Promise<void> {
        console.log(`[JobProcessor] Pausing job ${this.jobId}`)
        this.isPaused = true
        const timestamp = new Date().getTime()
        await this.updateProgress({
            status: "paused",
            message: `Job paused at ${timestamp}`,
        })
    }

    public async resume(): Promise<void> {
        console.log(`[JobProcessor] Resuming job ${this.jobId}`)
        this.isPaused = false
        await this.updateProgress({
            status: "processing",
            message: "Job resumed",
        })
    }

    public async stop(): Promise<void> {
        console.log(`[JobProcessor] Stopping job ${this.jobId}`)
        this.isRunning = false
        await this.updateProgress({
            status: "cancelled",
            message: "Job cancelled",
        })
    }

    // Add a new method to create an import log entry
    private async createImportLogEntry(): Promise<void> {
        if (!this.metadata) {
            console.error(
                `[JobProcessor] Cannot create import log entry: metadata not loaded`
            )
            return
        }

        try {
            console.log(
                `[JobProcessor] Creating import log entry for job ${this.jobId}`
            )

            const progress = await JobQueueService.getJobProgress(
                this.url,
                this.jobId
            )
            if (!progress) {
                console.error(
                    `[JobProcessor] Cannot create import log entry: progress not found`
                )
                return
            }

            const logEntry = {
                jobId: this.jobId,
                timestamp: new Date().toISOString(),
                vectorSetName: this.metadata.vectorSetName,
                filename: this.metadata.filename,
                recordsProcessed: progress.current,
                totalRecords: progress.total,
                embeddingConfig: this.metadata.embedding,
                status: "completed",
            }

            await RedisConnection.withClient(this.url, async (client) => {
                // Only store in the global import log
                await client.rPush("global:importlog", JSON.stringify(logEntry))

                // Trim logs to keep only the most recent 500 entries
                await client.lTrim("global:importlog", -500, -1)
            })

        } catch (error) {
            console.error(
                `[JobProcessor] Error creating import log entry:`,
                error
            )
        }
    }
}
