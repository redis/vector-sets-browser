import { JobQueueService } from './job-queue';
import { JobProgress, CSVJobMetadata, getJobStatusKey } from '@/app/types/job-queue';
import RedisClient from './redis-client';

export class JobProcessor {
    private url: string;
    private jobId: string;
    private isRunning: boolean = false;
    private isPaused: boolean = false;
    private metadata: CSVJobMetadata | null = null;

    constructor(url: string, jobId: string) {
        this.url = url;
        this.jobId = jobId;
    }

    private async getEmbedding(text: string): Promise<number[]> {
        if (!this.metadata) {
            throw new Error('Job metadata not loaded');
        }

        console.log(`[JobProcessor] Getting embedding for text: "${text.substring(0, 100)}..."`);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/embedding`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                config: this.metadata.embedding
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[JobProcessor] Failed to get embedding:', errorText);
            throw new Error(`Failed to get embedding: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        if (!Array.isArray(result)) {
            console.error('[JobProcessor] Invalid embedding response:', result);
            throw new Error('Invalid response from embedding API: expected array');
        }

        console.log(`[JobProcessor] Got embedding of length ${result.length}`);
        return result;
    }

    private async updateProgress(progress: Partial<JobProgress>): Promise<void> {
        console.log(`[JobProcessor] Updating progress for job ${this.jobId}:`, progress);
        await RedisClient.withConnection(this.url, async (client) => {
            const statusKey = getJobStatusKey(this.jobId);
            
            // First check if the job status key exists
            const exists = await client.exists(statusKey);
            if (!exists) {
                console.log(`[JobProcessor] Job ${this.jobId} status no longer exists, skipping progress update`);
                return;
            }

            const currentStatus = await client.hGetAll(statusKey);
            const currentData = currentStatus?.data ? JSON.parse(currentStatus.data) : {};
            
            // If the job is already marked as cancelled, don't update unless we're explicitly setting cancelled status
            if (currentData.status === 'cancelled' && progress.status !== 'cancelled') {
                console.log(`[JobProcessor] Job ${this.jobId} is cancelled, skipping non-cancellation progress update`);
                return;
            }
            
            const updatedData = { ...currentData, ...progress };
            await client.hSet(statusKey, { data: JSON.stringify(updatedData) });
        });
    }

    private async addToRedis(elementId: string, embedding: number[]): Promise<void> {
        if (!this.metadata) {
            throw new Error('Job metadata not loaded');
        }

        console.log(`[JobProcessor] Adding vector for element "${elementId}" to Redis (vector length: ${embedding.length})`);
        const result = await RedisClient.withConnection(this.url, async (client) => {
            await client.sendCommand([
                "VADD",
                this.metadata!.vectorSetName,
                "VALUES",
                String(embedding.length),
                ...embedding.map(String),
                elementId
            ]);
            return true;
        });

        if (!result.success) {
            console.error(`[JobProcessor] Failed to add vector to Redis:`, result.error);
            throw new Error(`Failed to add vector to Redis: ${result.error}`);
        }
        console.log(`[JobProcessor] Successfully added vector for element "${elementId}"`);
    }

    public async start(): Promise<void> {
        if (this.isRunning) {
            console.log(`[JobProcessor] Job ${this.jobId} is already running`);
            return;
        }

        console.log(`[JobProcessor] Starting job ${this.jobId}`);
        this.isRunning = true;
        this.isPaused = false;
        this.metadata = await JobQueueService.getJobMetadata(this.url, this.jobId);
        
        if (!this.metadata) {
            console.error(`[JobProcessor] No metadata found for job ${this.jobId}`);
            throw new Error('Job metadata not found');
        }
        console.log(`[JobProcessor] Loaded metadata for job ${this.jobId}:`, this.metadata);

        await this.updateProgress({
            status: 'processing',
            message: 'Processing started'
        });

        try {
            while (this.isRunning) {
                // Check if job is paused
                if (this.isPaused) {
                    console.log(`[JobProcessor] Job ${this.jobId} is paused, waiting...`);
                    
                    // Check if job was cancelled while paused
                    const progress = await JobQueueService.getJobProgress(this.url, this.jobId);
                    if (!progress || progress.status === 'cancelled') {
                        console.log(`[JobProcessor] Job ${this.jobId} was cancelled while paused`);
                        this.isRunning = false;
                        break;
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    continue;
                }

                const item = await JobQueueService.getNextQueueItem(this.url, this.jobId);
                if (!item) {
                    console.log(`[JobProcessor] No more items in queue for job ${this.jobId}`);
                    await this.updateProgress({
                        status: 'completed',
                        message: 'Processing completed'
                    });
                    break;
                }

                // Check if job status exists and if the job itself still exists
                const statusExists = await RedisClient.withConnection(this.url, async (client) => {
                    const statusKey = getJobStatusKey(this.jobId);
                    return await client.exists(statusKey);
                });

                if (!statusExists) {
                    console.log(`[JobProcessor] Job ${this.jobId} status no longer exists, stopping processing`);
                    this.isRunning = false;
                    break;
                }

                // Check if job metadata still exists
                const jobMetadata = await JobQueueService.getJobMetadata(this.url, this.jobId);
                
                // If status exists but job metadata doesn't, clean up the orphaned status key
                if (!jobMetadata) {
                    console.log(`[JobProcessor] Job ${this.jobId} metadata no longer exists but status does, cleaning up orphaned status`);
                    await RedisClient.withConnection(this.url, async (client) => {
                        const statusKey = getJobStatusKey(this.jobId);
                        await client.del(statusKey);
                    });
                    this.isRunning = false;
                    break;
                }

                // Check if job was cancelled or paused
                const progress = await JobQueueService.getJobProgress(this.url, this.jobId);
                if (!progress) {
                    console.log(`[JobProcessor] Job ${this.jobId} progress no longer exists, stopping processing`);
                    this.isRunning = false;
                    break;
                }
                
                if (progress.status === 'cancelled') {
                    console.log(`[JobProcessor] Job ${this.jobId} was cancelled`);
                    this.isRunning = false;
                    break;
                } else if (progress.status === 'paused') {
                    console.log(`[JobProcessor] Job ${this.jobId} was paused`);
                    this.isPaused = true;
                    continue;
                }

                try {
                    console.log(`[JobProcessor] Processing item ${item.index + 1}`);
                    // Process the item
                    const text_to_embed = `${item.rowData.title} ${item.rowData.plot_synopsis} ${item.rowData.tags}`;
                    const embedding = await this.getEmbedding(text_to_embed);
                    await this.addToRedis(item.rowData.title, embedding);

                    // Update progress
                    await this.updateProgress({
                        current: item.index + 1,
                        message: `Processed item ${item.index + 1}`
                    });
                } catch (error) {
                    console.error(`[JobProcessor] Error processing item ${item.index}:`, error);
                    await this.updateProgress({
                        message: `Error processing item ${item.index + 1}: ${error}`
                    });
                    // Continue with next item after error
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            console.error(`[JobProcessor] Job processing error:`, error);
            await this.updateProgress({
                status: 'failed',
                error: String(error),
                message: 'Job failed'
            });
        } finally {
            console.log(`[JobProcessor] Job ${this.jobId} finished`);
            this.isRunning = false;
        }
    }

    public async pause(): Promise<void> {
        console.log(`[JobProcessor] Pausing job ${this.jobId}`);
        this.isPaused = true;
        await this.updateProgress({
            status: 'paused',
            message: 'Job paused'
        });
    }

    public async resume(): Promise<void> {
        console.log(`[JobProcessor] Resuming job ${this.jobId}`);
        this.isPaused = false;
        await this.updateProgress({
            status: 'processing',
            message: 'Job resumed'
        });
    }

    public async stop(): Promise<void> {
        console.log(`[JobProcessor] Stopping job ${this.jobId}`);
        this.isRunning = false;
        await this.updateProgress({
            status: 'cancelled',
            message: 'Job cancelled'
        });
    }
} 