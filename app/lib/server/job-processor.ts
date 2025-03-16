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

        if (!text) {
            throw new Error('Text to embed is undefined or empty');
        }

        console.log(`[JobProcessor] Getting embedding for text: "${text.substring(0, 100)}..."`);
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/api/embeddings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text,
                config: this.metadata.embedding
            })
        });

        if (!response.ok) {
            console.error('[JobProcessor] Failed to get embedding for text:', text);
            throw new Error(`Failed to get embedding: ${text}`);
        }

        const data = await response.json();
        if (!data.success) {
            console.error('[JobProcessor] Failed to get embedding:', data.error);
            throw new Error(`Failed to get embedding: ${data.error}`);
        }

        if (!Array.isArray(data.result)) {
            console.error('[JobProcessor] Invalid embedding response:', data);
            throw new Error('Invalid response from embedding API: expected array');
        }

        console.log(`[JobProcessor] Got embedding of length ${data.result.length}`);
        return data.result;
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

    private async addToRedis(element: string, embedding: number[], attributes?: Record<string, string>): Promise<void> {
        if (!this.metadata) {
            throw new Error('Job metadata not loaded');
        }

        console.log(`[JobProcessor] Adding vector for element "${element}" to Redis (vector length: ${embedding.length})`);
        
        // Prepare the command
        const command = [
            "VADD",
            this.metadata.vectorSetName,
            "VALUES",
            String(embedding.length),
            ...embedding.map(String),
            element
        ];
        
        // Add attributes if they exist
        if (attributes && Object.keys(attributes).length > 0) {
            console.log(`[JobProcessor] Adding attributes:`, attributes);
            command.push("SETATTR");
            
            // Convert attributes to JSON string
            const attributesJson = JSON.stringify(attributes);
            command.push(attributesJson);
        }
        
        const result = await RedisClient.withConnection(this.url, async (client) => {
            await client.sendCommand(command);
            return true;
        });

        if (!result.success) {
            console.error(`[JobProcessor] Failed to add vector to Redis:`, result.error);
            throw new Error(`Failed to add vector to Redis: ${result.error}`);
        }
        console.log(`[JobProcessor] Successfully added vector for element "${element}"`);
    }

    private processTemplate(template: string, rowData: CSVRow): string {
        // Replace ${columnName} with the actual value from rowData
        return template.replace(/\${([^}]+)}/g, (match, columnName) => {
            return rowData[columnName] !== undefined ? rowData[columnName] : match;
        });
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
                    
                    // Create an import log entry before cleaning up the job
                    await this.createImportLogEntry();
                    
                    // Clean up the job data from Redis
                    await JobQueueService.cleanupJob(this.url, this.jobId);
                    
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
                    console.log(`[JobProcessor] Raw row data:`, JSON.stringify(item.rowData, null, 2));
                    
                    let elementId: string;
                    let textToEmbed: string;
                    
                    // Get the element identifier - either from template or column
                    if (this.metadata.elementTemplate) {
                        elementId = this.processTemplate(this.metadata.elementTemplate, item.rowData);
                        console.log(`[JobProcessor] Element identifier from template:`, elementId);
                    } else {
                        // Get the element identifier from the configured column
                        const elementColumn = this.metadata.elementColumn || 'title';
                        elementId = item.rowData[elementColumn];
                        console.log(`[JobProcessor] Element identifier from column '${elementColumn}':`, elementId);
                    }
                    
                    if (!elementId) {
                        console.warn(`[JobProcessor] Skipping item ${item.index + 1}: Element identifier not found`);
                        await this.updateProgress({
                            current: item.index + 1,
                            message: `Skipped item ${item.index + 1}: Missing element identifier`
                        });
                        continue;
                    }
                    
                    // Get the text to embed - either from template or column
                    if (this.metadata.textTemplate) {
                        textToEmbed = this.processTemplate(this.metadata.textTemplate, item.rowData);
                        console.log(`[JobProcessor] Text to embed from template (first 100 chars):`, 
                            textToEmbed ? textToEmbed.substring(0, 100) + '...' : 'undefined');
                    } else {
                        // Get the text to embed from the configured column
                        const textColumn = this.metadata.textColumn || 'plot_synopsis';
                        textToEmbed = item.rowData[textColumn];
                        console.log(`[JobProcessor] Text to embed from column '${textColumn}' (first 100 chars):`, 
                            textToEmbed ? textToEmbed.substring(0, 100) + '...' : 'undefined');
                    }
                    
                    if (!textToEmbed) {
                        console.warn(`[JobProcessor] Skipping item ${item.index + 1}: Text to embed not found`);
                        await this.updateProgress({
                            current: item.index + 1,
                            message: `Skipped item ${item.index + 1}: Missing text to embed`
                        });
                        continue;
                    }
                    
                    // Extract attributes if attribute columns are configured
                    const attributes: Record<string, string> = {};
                    if (this.metadata.attributeColumns && this.metadata.attributeColumns.length > 0) {
                        for (const column of this.metadata.attributeColumns) {
                            if (item.rowData[column] !== undefined) {
                                attributes[column] = item.rowData[column];
                            }
                        }
                        console.log(`[JobProcessor] Extracted attributes:`, attributes);
                    }
                    
                    console.log(`[JobProcessor] About to get embedding for text of length ${textToEmbed.length}`);
                    const embedding = await this.getEmbedding(textToEmbed);
                    console.log(`[JobProcessor] Successfully got embedding of length ${embedding.length}`);
                    
                    await this.addToRedis(elementId, embedding, Object.keys(attributes).length > 0 ? attributes : undefined);

                    // Update progress
                    await this.updateProgress({
                        current: item.index + 1,
                        message: `Processed item ${item.index + 1}`
                    });
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);
                    console.error(`[JobProcessor] Error processing item ${item.index + 1}:`, error);
                    await this.updateProgress({
                        current: item.index + 1,
                        message: `Error processing item ${item.index + 1}: ${errorMessage}`
                    });
                    // Continue with next item after error
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            console.error(`[JobProcessor] Job processing error:`, error);
            await this.updateProgress({
                status: 'failed',
                error: errorMessage,
                message: `Job failed: ${errorMessage}`
            });
        } finally {
            console.log(`[JobProcessor] Job ${this.jobId} finished`);
            this.isRunning = false;
        }
    }

    public async pause(): Promise<void> {
        console.log(`[JobProcessor] Pausing job ${this.jobId}`);
        this.isPaused = true;
        const timestamp = new Date().getTime();
        await this.updateProgress({
            status: 'paused',
            message: `Job paused at ${timestamp}`
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

    // Add a new method to create an import log entry
    private async createImportLogEntry(): Promise<void> {
        if (!this.metadata) {
            console.error(`[JobProcessor] Cannot create import log entry: metadata not loaded`);
            return;
        }
        
        try {
            console.log(`[JobProcessor] Creating import log entry for job ${this.jobId}`);
            
            const progress = await JobQueueService.getJobProgress(this.url, this.jobId);
            if (!progress) {
                console.error(`[JobProcessor] Cannot create import log entry: progress not found`);
                return;
            }
            
            const logEntry = {
                jobId: this.jobId,
                timestamp: new Date().toISOString(),
                vectorSetName: this.metadata.vectorSetName,
                filename: this.metadata.filename,
                recordsProcessed: progress.current,
                totalRecords: progress.total,
                embeddingConfig: this.metadata.embedding,
                status: 'completed'
            };
            
            await RedisClient.withConnection(this.url, async (client) => {
                // Store the log entry in a list for this vector set
                const logKey = `vectorset:${this.metadata?.vectorSetName}:importlog`;
                await client.rPush(logKey, JSON.stringify(logEntry));
                
                // Also store in a global import log
                await client.rPush('global:importlog', JSON.stringify(logEntry));
                
                // Trim logs to keep only the most recent 100 entries
                await client.lTrim(logKey, -100, -1);
                await client.lTrim('global:importlog', -500, -1);
            });
            
            console.log(`[JobProcessor] Import log entry created for job ${this.jobId}`);
        } catch (error) {
            console.error(`[JobProcessor] Error creating import log entry:`, error);
        }
    }
} 