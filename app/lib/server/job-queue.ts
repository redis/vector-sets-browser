import { ImportJobConfig } from "@/app/api/jobs"
import { EmbeddingConfig } from "@/app/embeddings/types/embeddingModels"
import RedisClient from "@/app/redis-server/server/commands"
import {
    CSVJobMetadata,
    CSVRow,
    JobProgress,
    JobQueueItem,
    getJobMetadataKey,
    getJobQueueKey,
    getJobStatusKey,
} from "@/app/types/job-queue"
import { parse } from "csv-parse/sync"
import { v4 as uuidv4 } from "uuid"

export class JobQueueService {
    public static async updateJobProgress(
        url: string,
        jobId: string,
        progress: Partial<JobProgress>
    ): Promise<JobProgress> {
        const result = await RedisClient.withConnection(url, async (client) => {
            const statusKey = getJobStatusKey(jobId)
            let currentProgress: JobProgress = {
                status: "pending",
                message: "",
                current: 0,
                total: 0,
                timestamp: Date.now(),
            }
            
            // Get current status
            const currentStatus = await client.hGetAll(statusKey)
            
            // If we have existing data, parse it
            if (currentStatus?.data) {
                try {
                    // Handle the case where data might be an object already
                    if (typeof currentStatus.data === 'object' && currentStatus.data !== null) {
                        currentProgress = currentStatus.data;
                    } else {
                        currentProgress = JSON.parse(currentStatus.data);
                    }
                } catch (error) {
                    console.error(`[JobQueue] Error parsing job progress for ${jobId}:`, error);
                    // Continue with default progress
                }
            }
            
            // Update with new values
            const updatedProgress: JobProgress = {
                ...currentProgress,
                ...progress,
                timestamp: Date.now(),
            }
            
            // Store the updated progress
            await client.hSet(statusKey, { data: JSON.stringify(updatedProgress) })
            return updatedProgress;
        })
        
        if (!result.success) {
            console.error(
                `[JobQueue] Failed to update progress for job ${jobId}:`,
                result.error
            )
            throw new Error(result.error)
        }
        
        return result.result;
    }

    public static async createJob(
        url: string,
        file: File,
        vectorSetName: string,
        embeddingConfig: EmbeddingConfig,
        options: ImportJobConfig
    ): Promise<string> {
        const jobId = uuidv4()

        // Set default options
        const delimiter = options?.delimiter || ","
        const hasHeader =
            options?.hasHeader !== undefined ? options.hasHeader : true
        const skipRows = options?.skipRows || 0
        const fileType = options?.fileType || "csv"
        const exportType = options?.exportType || "redis"

        // Validate output filename for JSON export
        if (exportType === "json" && !options?.outputFilename) {
            throw new Error("Output filename is required for JSON export")
        }

        let records: CSVRow[] = []
        let availableColumns: string[] = []
        
        // Handle different file types
        if (fileType === "csv") {
            const text = await file.text()
            records = parse(text, {
                columns: hasHeader,
                skip_empty_lines: true,
                delimiter,
                from_line: Math.max(1, skipRows + (hasHeader ? 1 : 0)),
            }) as CSVRow[]
            
            // Determine column names from the first record
            availableColumns = records.length > 0 ? Object.keys(records[0]) : []
        } 
        else if (fileType === "json") {
            // Parse JSON file
            const text = await file.text()
            const jsonData = JSON.parse(text)
            
            // Handle both array and object formats
            const dataArray = Array.isArray(jsonData) ? jsonData : [jsonData]
            
            // Convert JSON objects to records
            records = dataArray.map((item, index) => {
                // If the item has a vector property, store it for later use
                const vector = item.vector || item.embedding
                const record: CSVRow = {
                    id: item.id || String(index),
                    text: item.text || '',
                    ...item // Include all other properties as attributes
                }
                
                if (vector) {
                    // Store the vector directly in the record for later use
                    ;(record as any)._vector = vector
                }
                
                return record
            })
            
            // Get all unique keys from the first record for columns
            availableColumns = records.length > 0 ? Object.keys(records[0]) : []
            
            // Update attribute columns to include all fields except id, text, and vector
            if (!options.attributeColumns || options.attributeColumns.length === 0) {
                options.attributeColumns = availableColumns.filter(col => 
                    col !== 'id' && col !== 'text' && col !== 'vector' && col !== 'embedding' && !col.startsWith('_')
                )
            }
        }
        else if (fileType === "image" || fileType === "images") {
            
            // For image types, we create a single record with the image information
            if (options?.rawVectors && options.rawVectors.length > 0) {
                
                // Create a record for each image with pre-computed vector
                records = options.rawVectors.map((vector, index) => {
                    // Create a basic record for the image
                    const record: CSVRow = {
                        image: file.name,
                        index: String(index),
                        // Add any attribute columns with empty values
                        ...(options?.attributeColumns?.reduce((acc, col) => {
                            acc[col] = "";
                            return acc;
                        }, {} as Record<string, string>) || {})
                    };
                    
                    // Store the vector directly in the record for later use
                    (record as any)._vector = vector;
                    
                    return record;
                });
                
                availableColumns = ["image", "index", ...(options?.attributeColumns || [])];
            } else {
                // Just a single record for the image without pre-computed vector
                records = [{
                    image: file.name,
                    index: "0",
                    // Add any attribute columns with empty values
                    ...(options?.attributeColumns?.reduce((acc, col) => {
                        acc[col] = "";
                        return acc;
                    }, {} as Record<string, string>) || {})
                }];
                availableColumns = ["image", "index", ...(options?.attributeColumns || [])];
            }
        }
        
        // Select appropriate columns based on options or defaults
        const elementColumn =
            options?.elementColumn ||
            (availableColumns.includes("title")
                ? "title"
                : availableColumns[0] || "title")

        const textColumn =
            options?.textColumn ||
            (availableColumns.includes("plot_synopsis")
                ? "plot_synopsis"
                : availableColumns.length > 1
                ? availableColumns[1]
                : "plot_synopsis")

        const result = await RedisClient.withConnection(url, async (client) => {
            // Create job metadata
            const metadata: CSVJobMetadata = {
                jobId,
                filename: file.name,
                vectorSetName,
                embedding: embeddingConfig,
                elementColumn,
                textColumn,
                elementTemplate: options?.elementTemplate,
                textTemplate: options?.textTemplate,
                attributeColumns: options?.attributeColumns || [],
                total: records.length,
                delimiter,
                hasHeader,
                skipRows,
                fileType,
                exportType,
                outputFilename: options?.outputFilename,
            }
            await client.hSet(getJobMetadataKey(jobId), {
                data: JSON.stringify(metadata),
            })

            // Initialize job status
            const initialProgress: JobProgress = {
                current: 0,
                total: records.length,
                status: "pending",
                message: "Job created",
            }
            await client.hSet(getJobStatusKey(jobId), {
                data: JSON.stringify(initialProgress),
            })

            // Add records to job queue
            const queueKey = getJobQueueKey(jobId)
            for (let i = 0; i < records.length; i++) {
                const item: JobQueueItem = {
                    jobId,
                    rowData: records[i],
                    index: i,
                }
                await client.rPush(queueKey, JSON.stringify(item))
            }

            return jobId
        })

        if (!result.success) {
            console.error(
                `[JobQueue] Failed to create job ${jobId}:`,
                result.error
            )
            throw new Error(result.error)
        }
        return result.result
    }

    public static async getJobProgress(
        url: string,
        jobId: string
    ): Promise<JobProgress | null> {
        // console.log(`[JobQueue] Getting progress for job ${jobId}`);
        const result = await RedisClient.withConnection(url, async (client) => {
            const statusKey = getJobStatusKey(jobId)
            const status = await client.hGetAll(statusKey)
            
            if (!status || !status.data) return null
            
            // Handle the case where data might already be an object
            try {
                if (typeof status.data === 'object' && status.data !== null) {
                    return status.data as JobProgress;
                } else {
                    return JSON.parse(status.data) as JobProgress;
                }
            } catch (error) {
                console.error(`[JobQueue] Error parsing job progress for ${jobId}:`, error);
                return null;
            }
        })
        
        if (!result.success) {
            console.error(
                `[JobQueue] Failed to get progress for job ${jobId}:`,
                result.error
            )
            throw new Error(result.error)
        }
        
        return result.result
    }

    public static async pauseJob(url: string, jobId: string): Promise<void> {
        await JobQueueService.updateJobProgress(url, jobId, {
            status: "paused",
            message: "Job paused by user",
        })
    }

    public static async resumeJob(url: string, jobId: string): Promise<void> {
        await JobQueueService.updateJobProgress(url, jobId, {
            status: "processing",
            message: "Job resumed",
        })
    }

    public static async cancelJob(url: string, jobId: string): Promise<void> {
        await JobQueueService.updateJobProgress(url, jobId, {
            status: "cancelled",
            message: "Job cancelled by user",
        })
    }

    public static async getJobMetadata(
        url: string,
        jobId: string
    ): Promise<CSVJobMetadata | null> {
        //console.log(`[JobQueue] Getting metadata for job ${jobId}`);
        const result = await RedisClient.withConnection(url, async (client) => {
            const metadataKey = getJobMetadataKey(jobId)
            const metadata = await client.hGetAll(metadataKey)
            if (!metadata || !metadata.data) return null
            return JSON.parse(metadata.data) as CSVJobMetadata
        })
        if (!result.success) {
            console.error(
                `[JobQueue] Failed to get metadata for job ${jobId}:`,
                result.error
            )
            throw new Error(result.error)
        }
        //console.log(`[JobQueue] Metadata for job ${jobId}:`, result.result);
        return result.result
    }

    public static async getNextQueueItem(
        url: string,
        jobId: string
    ): Promise<JobQueueItem | null> {
        const result = await RedisClient.withConnection(url, async (client) => {
            const queueKey = getJobQueueKey(jobId)
            const item = await client.lPop(queueKey)
            return item ? (JSON.parse(item) as JobQueueItem) : null
        })
        if (!result.success) {
            console.error(
                `[JobQueue] Failed to get next queue item for job ${jobId}:`,
                result.error
            )
            throw new Error(result.error)
        }
        return result.result
    }

    public static async cleanupJob(url: string, jobId: string): Promise<void> {
        const result = await RedisClient.withConnection(url, async (client) => {
            const keys = [
                getJobQueueKey(jobId),
                getJobStatusKey(jobId),
                getJobMetadataKey(jobId),
            ]
            await client.del(keys)
            return true
        })
        if (!result.success) {
            console.error(
                `[JobQueue] Failed to cleanup job ${jobId}:`,
                result.error
            )
            throw new Error(result.error)
        }
    }
}
