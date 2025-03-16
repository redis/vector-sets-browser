import { v4 as uuidv4 } from 'uuid';
import { parse } from 'csv-parse/sync';
import RedisClient from './redis-client';
import { JobProgress, CSVJobMetadata, CSVRow, JobQueueItem, getJobQueueKey, getJobStatusKey, getJobMetadataKey } from '@/app/types/job-queue';
import { EmbeddingConfig } from '@/app/types/embedding';

export class JobQueueService {
    private static async updateJobProgress(url: string, jobId: string, progress: Partial<JobProgress>) {
        console.log(`[JobQueue] Updating progress for job ${jobId}:`, progress);
        const result = await RedisClient.withConnection(url, async (client) => {
            const statusKey = getJobStatusKey(jobId);
            const currentStatus = await client.hGetAll(statusKey);
            const currentData = currentStatus?.data ? JSON.parse(currentStatus.data) : {};
            const updatedData = { ...currentData, ...progress };
            await client.hSet(statusKey, { data: JSON.stringify(updatedData) });
            return true;
        });
        if (!result.success) {
            console.error(`[JobQueue] Failed to update progress for job ${jobId}:`, result.error);
            throw new Error(result.error);
        }
        console.log(`[JobQueue] Progress updated successfully for job ${jobId}`);
    }

    public static async createJob(
        url: string, 
        file: File, 
        vectorSetName: string, 
        embeddingConfig: EmbeddingConfig,
        options?: {
            elementColumn?: string;
            textColumn?: string;
            elementTemplate?: string;
            textTemplate?: string;
            attributeColumns?: string[];
            delimiter?: string;
            hasHeader?: boolean;
            skipRows?: number;
        }
    ): Promise<string> {
        const jobId = uuidv4();
        console.log(`[JobQueue] Creating new job ${jobId} for vector set ${vectorSetName}`);
        console.log(`[JobQueue] Options:`, options);
        
        // Set default options
        const delimiter = options?.delimiter || ',';
        const hasHeader = options?.hasHeader !== undefined ? options.hasHeader : true;
        const skipRows = options?.skipRows || 0;
        
        console.log(`[JobQueue] Reading CSV file ${file.name}`);
        const text = await file.text();
        const records = parse(text, {
            columns: hasHeader,
            skip_empty_lines: true,
            delimiter,
            from_line: Math.max(1, skipRows + (hasHeader ? 1 : 0))
        }) as CSVRow[];
        console.log(`[JobQueue] Parsed ${records.length} records from CSV`);

        // Determine column names from the first record
        const availableColumns = records.length > 0 ? Object.keys(records[0]) : [];
        console.log(`[JobQueue] Available columns:`, availableColumns);
        
        // Select appropriate columns based on options or defaults
        const elementColumn = options?.elementColumn || 
            (availableColumns.includes('title') ? 'title' : availableColumns[0] || 'title');
        
        const textColumn = options?.textColumn || 
            (availableColumns.includes('plot_synopsis') ? 'plot_synopsis' : 
             availableColumns.length > 1 ? availableColumns[1] : 'plot_synopsis');
        
        console.log(`[JobQueue] Selected element column: ${elementColumn}`);
        console.log(`[JobQueue] Selected text column: ${textColumn}`);
        
        if (options?.attributeColumns) {
            console.log(`[JobQueue] Selected attribute columns:`, options.attributeColumns);
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
                skipRows
            };
            console.log(`[JobQueue] Setting metadata for job ${jobId}:`, metadata);
            await client.hSet(getJobMetadataKey(jobId), { data: JSON.stringify(metadata) });

            // Initialize job status
            const initialProgress: JobProgress = {
                current: 0,
                total: records.length,
                status: 'pending',
                message: 'Job created'
            };
            console.log(`[JobQueue] Setting initial progress for job ${jobId}:`, initialProgress);
            await client.hSet(getJobStatusKey(jobId), { data: JSON.stringify(initialProgress) });

            // Add records to job queue
            const queueKey = getJobQueueKey(jobId);
            console.log(`[JobQueue] Adding ${records.length} records to queue ${queueKey}`);
            for (let i = 0; i < records.length; i++) {
                const item: JobQueueItem = {
                    jobId,
                    rowData: records[i],
                    index: i
                };
                await client.rPush(queueKey, JSON.stringify(item));
            }

            return jobId;
        });

        if (!result.success) {
            console.error(`[JobQueue] Failed to create job ${jobId}:`, result.error);
            throw new Error(result.error);
        }
        console.log(`[JobQueue] Successfully created job ${jobId}`);
        return result.result;
    }

    public static async getJobProgress(url: string, jobId: string): Promise<JobProgress | null> {
        //console.log(`[JobQueue] Getting progress for job ${jobId}`);
        const result = await RedisClient.withConnection(url, async (client) => {
            const statusKey = getJobStatusKey(jobId);
            const status = await client.hGetAll(statusKey);
            if (!status || !status.data) return null;
            return JSON.parse(status.data) as JobProgress;
        });
        if (!result.success) {
            console.error(`[JobQueue] Failed to get progress for job ${jobId}:`, result.error);
            throw new Error(result.error);
        }
        //console.log(`[JobQueue] Progress for job ${jobId}:`, result.result);
        return result.result;
    }

    public static async pauseJob(url: string, jobId: string): Promise<void> {
        await JobQueueService.updateJobProgress(url, jobId, {
            status: 'paused',
            message: 'Job paused by user'
        });
    }

    public static async resumeJob(url: string, jobId: string): Promise<void> {
        await JobQueueService.updateJobProgress(url, jobId, {
            status: 'processing',
            message: 'Job resumed'
        });
    }

    public static async cancelJob(url: string, jobId: string): Promise<void> {
        await JobQueueService.updateJobProgress(url, jobId, {
            status: 'cancelled',
            message: 'Job cancelled by user'
        });
    }

    public static async getJobMetadata(url: string, jobId: string): Promise<CSVJobMetadata | null> {
        //console.log(`[JobQueue] Getting metadata for job ${jobId}`);
        const result = await RedisClient.withConnection(url, async (client) => {
            const metadataKey = getJobMetadataKey(jobId);
            const metadata = await client.hGetAll(metadataKey);
            if (!metadata || !metadata.data) return null;
            return JSON.parse(metadata.data) as CSVJobMetadata;
        });
        if (!result.success) {
            console.error(`[JobQueue] Failed to get metadata for job ${jobId}:`, result.error);
            throw new Error(result.error);
        }
        //console.log(`[JobQueue] Metadata for job ${jobId}:`, result.result);
        return result.result;
    }

    public static async getNextQueueItem(url: string, jobId: string): Promise<JobQueueItem | null> {
        console.log(`[JobQueue] Getting next queue item for job ${jobId}`);
        const result = await RedisClient.withConnection(url, async (client) => {
            const queueKey = getJobQueueKey(jobId);
            const item = await client.lPop(queueKey);
            return item ? JSON.parse(item) as JobQueueItem : null;
        });
        if (!result.success) {
            console.error(`[JobQueue] Failed to get next queue item for job ${jobId}:`, result.error);
            throw new Error(result.error);
        }
        console.log(`[JobQueue] Next queue item for job ${jobId}`);
        return result.result;
    }

    public static async cleanupJob(url: string, jobId: string): Promise<void> {
        console.log(`[JobQueue] Cleaning up job ${jobId}`);
        const result = await RedisClient.withConnection(url, async (client) => {
            const keys = [
                getJobQueueKey(jobId),
                getJobStatusKey(jobId),
                getJobMetadataKey(jobId)
            ];
            await client.del(keys);
            return true;
        });
        if (!result.success) {
            console.error(`[JobQueue] Failed to cleanup job ${jobId}:`, result.error);
            throw new Error(result.error);
        }
        console.log(`[JobQueue] Successfully cleaned up job ${jobId}`);
    }
} 