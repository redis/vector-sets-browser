import { EmbeddingConfig } from "@/app/embeddings/types/config"
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
import RedisClient from "../../redis-server/server/commands"

export class JobQueueService {
    private static async updateJobProgress(
        url: string,
        jobId: string,
        progress: Partial<JobProgress>
    ): Promise<JobProgress> {
        console.log(`[JobQueue] Updating progress for job ${jobId}:`, progress)
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
        
        console.log(`[JobQueue] Progress updated successfully for job ${jobId}`)
        return result.result;
    }

    public static async createJob(
        url: string,
        file: File,
        vectorSetName: string,
        embeddingConfig: EmbeddingConfig,
        options?: {
            elementColumn?: string
            textColumn?: string
            elementTemplate?: string
            textTemplate?: string
            attributeColumns?: string[]
            delimiter?: string
            hasHeader?: boolean
            skipRows?: number
            fileType?: string
            rawVectors?: number[][]
        }
    ): Promise<string> {
        const jobId = uuidv4()
        console.log(
            `[JobQueue] Creating new job ${jobId} for vector set ${vectorSetName}`
        )
        console.log(`[JobQueue] Options:`, options)

        // Set default options
        const delimiter = options?.delimiter || ","
        const hasHeader =
            options?.hasHeader !== undefined ? options.hasHeader : true
        const skipRows = options?.skipRows || 0
        const fileType = options?.fileType || "csv"

        let records: CSVRow[] = [];
        let availableColumns: string[] = [];
        
        // Handle different file types
        if (fileType === "csv") {
            console.log(`[JobQueue] Reading CSV file ${file.name}`)
            const text = await file.text()
            records = parse(text, {
                columns: hasHeader,
                skip_empty_lines: true,
                delimiter,
                from_line: Math.max(1, skipRows + (hasHeader ? 1 : 0)),
            }) as CSVRow[]
            console.log(`[JobQueue] Parsed ${records.length} records from CSV`)
            
            // Determine column names from the first record
            availableColumns = records.length > 0 ? Object.keys(records[0]) : []
        } 
        else if (fileType === "image" || fileType === "images") {
            console.log(`[JobQueue] Processing image file: ${file.name}`)
            
            // For image types, we create a single record with the image information
            if (options?.rawVectors && options.rawVectors.length > 0) {
                console.log(`[JobQueue] Using ${options.rawVectors.length} pre-computed vectors for images`)
                
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
        
        console.log(`[JobQueue] Available columns:`, availableColumns)

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

        console.log(`[JobQueue] Selected element column: ${elementColumn}`)
        console.log(`[JobQueue] Selected text column: ${textColumn}`)

        if (options?.attributeColumns) {
            console.log(
                `[JobQueue] Selected attribute columns:`,
                options.attributeColumns
            )
        }

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
            }
            console.log(
                `[JobQueue] Setting metadata for job ${jobId}:`,
                metadata
            )
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
            console.log(
                `[JobQueue] Setting initial progress for job ${jobId}:`,
                initialProgress
            )
            await client.hSet(getJobStatusKey(jobId), {
                data: JSON.stringify(initialProgress),
            })

            // Add records to job queue
            const queueKey = getJobQueueKey(jobId)
            console.log(
                `[JobQueue] Adding ${records.length} records to queue ${queueKey}`
            )
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
        console.log(`[JobQueue] Successfully created job ${jobId}`)
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
        console.log(`[JobQueue] Getting next queue item for job ${jobId}`)
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
        console.log(`[JobQueue] Next queue item for job ${jobId}`)
        return result.result
    }

    public static async cleanupJob(url: string, jobId: string): Promise<void> {
        console.log(`[JobQueue] Cleaning up job ${jobId}`)
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
        console.log(`[JobQueue] Successfully cleaned up job ${jobId}`)
    }
}
