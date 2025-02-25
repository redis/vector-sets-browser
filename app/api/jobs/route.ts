import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { JobQueueService } from '@/app/lib/server/job-queue';
import { JobProcessor } from '@/app/lib/server/job-processor';
import RedisClient from '@/app/lib/server/redis-client';
import { VectorSetMetadata } from '@/app/types/embedding';

const REDIS_URL_COOKIE = 'redis_url';

// Map to store active job processors
const activeProcessors = new Map<string, JobProcessor>();

// Helper to get Redis URL
function getRedisUrl(): string | null {
    const url = cookies().get(REDIS_URL_COOKIE)?.value;
    return url || null;
}

// List all jobs and their status
export async function GET(req: NextRequest) {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');
    const vectorSetName = url.searchParams.get('vectorSetName');

    try {
        const redisUrl = getRedisUrl();
        if (!redisUrl) {
            console.log('No Redis URL available');
            return NextResponse.json([]);
        }

        // If jobId is provided, return specific job details
        if (jobId) {
            const [status, metadata] = await Promise.all([
                JobQueueService.getJobProgress(redisUrl, jobId),
                JobQueueService.getJobMetadata(redisUrl, jobId)
            ]);

            if (!status) {
                console.log(`Job ${jobId} not found`);
                return NextResponse.json({ error: 'Job not found' }, { status: 404 });
            }

            console.log(`Returning job ${jobId}:`, { status, metadata });
            return NextResponse.json({ jobId, status, metadata });
        }

        // Otherwise, list all jobs
        const result = await RedisClient.withConnection(redisUrl, async (client) => {
            const keys = await client.keys('job:*:status');
            console.log('Found job status keys:', keys);
            const jobs = [];

            for (const key of keys) {
                const jobId = key.split(':')[1];
                const [status, metadata] = await Promise.all([
                    JobQueueService.getJobProgress(redisUrl, jobId),
                    JobQueueService.getJobMetadata(redisUrl, jobId)
                ]);

                console.log(`Job ${jobId} status:`, status);
                console.log(`Job ${jobId} metadata:`, metadata);

                if (status && metadata) {
                    // If vectorSetName is provided, only include jobs for that vector set
                    if (vectorSetName && metadata.vectorSetName !== vectorSetName) {
                        console.log(`Skipping job ${jobId} - wrong vector set`);
                        continue;
                    }
                    jobs.push({
                        jobId,
                        status,
                        metadata
                    });
                }
            }

            console.log('Returning jobs:', jobs);
            return jobs;
        });

        if (!result.success) {
            console.error('Error getting jobs:', result.error);
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json(result.result);
    } catch (error) {
        console.error('Error getting job(s):', error);
        return NextResponse.json([]);
    }
}

// Create a new job
export async function POST(req: NextRequest) {
    try {
        const redisUrl = getRedisUrl();
        
        // Check if this is a multipart form data request
        const contentType = req.headers.get('content-type');
        if (!contentType?.includes('multipart/form-data')) {
            return NextResponse.json({ 
                error: 'Invalid content type. Expected multipart/form-data',
                receivedContentType: contentType 
            }, { status: 400 });
        }

        // Clone the request to ensure we can read the body
        const clonedReq = req.clone();
        const formData = await clonedReq.formData();
        const file = formData.get('file') as File;
        const vectorSetName = formData.get('vectorSetName') as string;

        if (!file || !vectorSetName) {
            return NextResponse.json({ 
                error: 'File and vector set name are required',
                received: {
                    hasFile: !!file,
                    vectorSetName: !!vectorSetName
                }
            }, { status: 400 });
        }

        // Get vector set metadata
        const metadataResult = await RedisClient.withConnection(redisUrl, async (client) => {
            const metadataKey = `${vectorSetName}_metadata`;
            const storedData = await client.hGetAll(metadataKey);
            return storedData;
        });

        if (!metadataResult.success) {
            return NextResponse.json({ 
                error: 'Failed to get vector set metadata',
                details: metadataResult.error
            }, { status: 400 });
        }

        const metadata = metadataResult.result.data ? 
            (typeof metadataResult.result.data === 'string' ? 
                JSON.parse(metadataResult.result.data) : 
                metadataResult.result.data) as VectorSetMetadata : 
            null;

        if (!metadata?.embedding) {
            return NextResponse.json({ 
                error: 'No embedding configuration found for this vector set',
                vectorSetName,
                metadata 
            }, { status: 400 });
        }

        // Create and start the job
        const jobId = await JobQueueService.createJob(redisUrl, file, vectorSetName, metadata.embedding);
        
        // Start processing the job
        const processor = new JobProcessor(redisUrl, jobId);
        activeProcessors.set(jobId, processor);
        
        // Start processing in the background
        processor.start().catch(error => {
            console.error('Job processing error:', error);
            activeProcessors.delete(jobId);
        });

        return NextResponse.json({ success: true, jobId });
    } catch (error) {
        console.error('Error creating job:', error);
        return NextResponse.json({ 
            error: String(error),
            stack: (error as Error).stack
        }, { status: 500 });
    }
}

// Pause/Resume a job
export async function PATCH(req: NextRequest) {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');
    const action = url.searchParams.get('action');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    if (!action || !['pause', 'resume'].includes(action)) {
        return NextResponse.json({ error: 'Action must be either "pause" or "resume"' }, { status: 400 });
    }

    try {
        const redisUrl = getRedisUrl();
        
        // Get the processor if it exists
        const processor = activeProcessors.get(jobId);
        
        if (action === 'pause') {
            if (processor) {
                await processor.pause();
            }
            await JobQueueService.pauseJob(redisUrl, jobId);
        } else {
            if (processor) {
                await processor.resume();
            } else {
                // If no active processor, create a new one and start it
                const newProcessor = new JobProcessor(redisUrl, jobId);
                activeProcessors.set(jobId, newProcessor);
                newProcessor.start().catch(error => {
                    console.error('Job processing error:', error);
                    activeProcessors.delete(jobId);
                });
            }
            await JobQueueService.resumeJob(redisUrl, jobId);
        }
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(`Error ${action}ing job:`, error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

// Cancel a specific job
export async function DELETE(req: NextRequest) {
    const url = new URL(req.url);
    const jobId = url.searchParams.get('jobId');

    if (!jobId) {
        return NextResponse.json({ error: 'Job ID is required' }, { status: 400 });
    }

    try {
        const redisUrl = getRedisUrl();
        
        // Stop the processor if it's running
        const processor = activeProcessors.get(jobId);
        if (processor) {
            await processor.stop();
            activeProcessors.delete(jobId);
        }

        // Cancel and clean up the job in Redis
        await JobQueueService.cancelJob(redisUrl, jobId);
        await JobQueueService.cleanupJob(redisUrl, jobId);
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error cancelling job:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
} 