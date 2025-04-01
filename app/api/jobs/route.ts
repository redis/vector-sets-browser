import { JobProcessor } from "@/app/lib/server/job-processor"
import { JobQueueService } from "@/app/lib/server/job-queue"
import RedisClient, * as redis from "@/app/redis-server/server/commands"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { NextRequest, NextResponse } from "next/server"
import { vectorSets } from "@/app/lib/server/vector-sets"

// Map to store active job processors
const activeProcessors = new Map<string, JobProcessor>()

// List all jobs and their status
export async function GET(req: NextRequest) {
    let url;
    let jobId;
    let vectorSetName;
    try {
        url = new URL(req.url);
        jobId = url.searchParams.get("jobId");
        vectorSetName = url.searchParams.get("vectorSetName");
    } catch (error) {
        console.error("Error parsing URL:", error, "URL:", req.url);
        return NextResponse.json({ 
            success: false, 
            error: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}` 
        }, { status: 400 });
    }

    const redisUrl = await redis.getRedisUrl()

    if (!redisUrl) {
        return NextResponse.json({ success: false, error: "No Redis URL configured" }, { status: 400 })
    }

    try {
        // If jobId is provided, return specific job details
        if (jobId) {
            const [status, metadata] = await Promise.all([
                JobQueueService.getJobProgress(redisUrl, jobId),
                JobQueueService.getJobMetadata(redisUrl, jobId),
            ])
            
            if (!status) {
                return NextResponse.json(
                    { success: false, error: "Job not found" },
                    { status: 404 }
                )
            }
            
            // Return the job details directly without unnecessary wrapping
            return NextResponse.json({ 
                success: true,
                result: { 
                    jobId, 
                    status, 
                    metadata 
                }
            })
        }

        // Otherwise, list all jobs
        const result = await RedisClient.withConnection(
            redisUrl,
            async (client) => {
                const keys = await client.keys("job:*:status")
                const jobs = []
                
                for (const key of keys) {
                    const jobId = key.split(":")[1]
                    
                    // Skip if the key format is invalid
                    if (!jobId) continue;
                    
                    const [status, metadata] = await Promise.all([
                        JobQueueService.getJobProgress(redisUrl, jobId),
                        JobQueueService.getJobMetadata(redisUrl, jobId),
                    ])
                    
                    if (status && metadata) {
                        // If vectorSetName is provided, only include jobs for that vector set
                        if (
                            vectorSetName &&
                            metadata.vectorSetName !== vectorSetName
                        ) {
                            continue
                        }
                        
                        // Add the job with proper structure
                        jobs.push({ 
                            jobId, 
                            status, 
                            metadata 
                        })
                    }
                }
                
                return jobs
            }
        )

        if (!result.success) {
            return NextResponse.json({ success: false, error: result.error }, { status: 500 })
        }

        return NextResponse.json({
            success: true,
            result: result.result
        })
    } catch (error) {
        console.error("Error getting job(s):", error)
        return NextResponse.json({ 
            success: false, 
            error: String(error) 
        }, { status: 500 })
    }
}

// Create a new job
export async function POST(req: NextRequest) {
    const redisUrl = await redis.getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json({ success: false, error: "No Redis URL configured" }, { status: 400 })
    }

    try {
        const body = await req.json();
        const { vectorSetName, fileContent, fileName, config } = body;

        // Create a File object from the content
        const file = new File([fileContent], fileName, {
            type: 'application/octet-stream'
        });

        // Get metadata for the vector set
        const metadata = await vectorSets.getMetadata(vectorSetName)
        if (!metadata) {
            return NextResponse.json(
                { error: "Vector set not found" },
                { status: 404 }
            )
        }

        try {
            const jobId = await JobQueueService.createJob(redisUrl, file, vectorSetName, metadata.embedding, config)

            // Start processing the job
            const processor = new JobProcessor(redisUrl, jobId)
            activeProcessors.set(jobId, processor)

            // Start processing in the background
            processor.start().catch((error) => {
                console.error("Job processing error:", error)
                activeProcessors.delete(jobId)
            })

            return NextResponse.json({ success: true, jobId })
        } catch (error) {
            console.error("[Jobs API] Error creating job:", error)
            return NextResponse.json(
                { error: "Failed to create job" },
                { status: 500 }
            )
        }
    } catch (error) {
        console.error("[Jobs API] Error parsing request:", error)
        return NextResponse.json(
            { error: "Invalid request format" },
            { status: 400 }
        )
    }
}

// Pause/Resume a job
export async function PATCH(req: NextRequest) {
    let url;
    let jobId;
    let action;
    
    try {
        url = new URL(req.url);
        jobId = url.searchParams.get("jobId");
        action = url.searchParams.get("action");
    } catch (error) {
        console.error("Error parsing URL:", error, "URL:", req.url);
        return NextResponse.json({ 
            success: false, 
            error: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}` 
        }, { status: 400 });
    }

    if (!jobId) {
        return NextResponse.json(
            { error: "Job ID is required" },
            { status: 400 }
        )
    }

    if (!action || !["pause", "resume"].includes(action)) {
        return NextResponse.json(
            { error: 'Action must be either "pause" or "resume"' },
            { status: 400 }
        )
    }

    const redisUrl = await redis.getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json({ success: false, error: "No Redis URL configured" }, { status: 400 })
    }

    try {
        // Get the processor if it exists
        const processor = activeProcessors.get(jobId)

        if (action === "pause") {
            if (processor) {
                await processor.pause()
            }
            await JobQueueService.pauseJob(redisUrl, jobId)
        } else {
            if (processor) {
                await processor.resume()
            } else {
                // If no active processor, create a new one and start it
                const newProcessor = new JobProcessor(redisUrl, jobId)
                activeProcessors.set(jobId, newProcessor)
                newProcessor.start().catch((error) => {
                    console.error("Job processing error:", error)
                    activeProcessors.delete(jobId)
                })
            }
            await JobQueueService.resumeJob(redisUrl, jobId)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(`Error ${action}ing job:`, error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

// Cancel a specific job
export async function DELETE(req: NextRequest) {
    let url;
    let jobId;
    
    try {
        url = new URL(req.url);
        jobId = url.searchParams.get("jobId");
    } catch (error) {
        console.error("Error parsing URL:", error, "URL:", req.url);
        return NextResponse.json({ 
            success: false, 
            error: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}` 
        }, { status: 400 });
    }

    if (!jobId) {
        return NextResponse.json(
            { error: "Job ID is required" },
            { status: 400 }
        )
    }

    const redisUrl = await redis.getRedisUrl()
    if (!redisUrl) {
        return NextResponse.json({ success: false, error: "No Redis URL configured" }, { status: 400 })
    }

    try {
        // Stop the processor if it's running
        const processor = activeProcessors.get(jobId)
        if (processor) {
            await processor.stop()
            activeProcessors.delete(jobId)
        }

        // Cancel and clean up the job in Redis
        await JobQueueService.cancelJob(redisUrl, jobId)
        await JobQueueService.cleanupJob(redisUrl, jobId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error cancelling job:", error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
