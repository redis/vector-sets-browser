import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { JobQueueService } from "@/app/lib/server/job-queue"
import { JobProcessor } from "@/app/lib/server/job-processor"
import RedisClient from "@/app/lib/server/redis-client"
import * as redis from "@/app/lib/server/redis-client"
import { VectorSetMetadata } from "@/app/types/embedding"
const REDIS_URL_COOKIE = "redis_url"

// Map to store active job processors
const activeProcessors = new Map<string, JobProcessor>()

// Helper to get Redis URL with error handling
function getRedisUrlOrError(): { url: string } | { error: string } {
    const url = cookies().get(REDIS_URL_COOKIE)?.value
    if (!url) {
        return { error: "Redis URL not configured" }
    }
    return { url }
}

// List all jobs and their status
export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const jobId = url.searchParams.get("jobId")
    const vectorSetName = url.searchParams.get("vectorSetName")

    const redisResult = getRedisUrlOrError()
    if ("error" in redisResult) {
        return NextResponse.json({ success: false, error: redisResult.error }, { status: 400 })
    }

    try {
        // If jobId is provided, return specific job details
        if (jobId) {
            const [status, metadata] = await Promise.all([
                JobQueueService.getJobProgress(redisResult.url, jobId),
                JobQueueService.getJobMetadata(redisResult.url, jobId),
            ])

            if (!status) {
                return NextResponse.json(
                    { success: false, error: "Job not found" },
                    { status: 404 }
                )
            }

            return NextResponse.json({ 
                success: true,
                result: { jobId, status, metadata }
            })
        }

        // Otherwise, list all jobs
        const result = await RedisClient.withConnection(
            redisResult.url,
            async (client) => {
                const keys = await client.keys("job:*:status")
                const jobs = []

                for (const key of keys) {
                    const jobId = key.split(":")[1]
                    const [status, metadata] = await Promise.all([
                        JobQueueService.getJobProgress(redisResult.url, jobId),
                        JobQueueService.getJobMetadata(redisResult.url, jobId),
                    ])
                    if (status && metadata) {
                        // If vectorSetName is provided, only include jobs for that vector set
                        if (
                            vectorSetName &&
                            metadata.vectorSetName !== vectorSetName
                        ) {
                            continue
                        }
                        jobs.push({ jobId, status, metadata })
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
    const redisResult = getRedisUrlOrError()
    if ("error" in redisResult) {
        return NextResponse.json({ error: redisResult.error }, { status: 400 })
    }

    try {
        // Check if this is a multipart form data request
        const contentType = req.headers.get("content-type")
        if (!contentType?.includes("multipart/form-data")) {
            return NextResponse.json(
                {
                    error: "Invalid content type. Expected multipart/form-data",
                    receivedContentType: contentType,
                },
                { status: 400 }
            )
        }

        // Clone the request to ensure we can read the body
        const clonedReq = req.clone()
        const formData = await clonedReq.formData()
        const file = formData.get("file") as File
        const vectorSetName = formData.get("vectorSetName") as string

        if (!file || !vectorSetName) {
            return NextResponse.json(
                {
                    error: "File and vector set name are required",
                    received: {
                        hasFile: !!file,
                        vectorSetName: !!vectorSetName,
                    },
                },
                { status: 400 }
            )
        }

        // Log form data for debugging
        console.log(`[Jobs API] Creating job for vector set ${vectorSetName}`);
        console.log(`[Jobs API] Form data keys:`, Array.from(formData.keys()));
        
        // Get element column and text column from form data
        const elementColumn = formData.get("elementColumn") as string;
        const textColumn = formData.get("textColumn") as string;
        
        // Get template fields if they exist
        const elementTemplate = formData.get("elementTemplate") as string;
        const textTemplate = formData.get("textTemplate") as string;
        
        // Get attribute columns from form data
        const attributeColumns = formData.getAll("attributeColumns") as string[];
        
        // Get other configuration options
        const delimiter = formData.get("delimiter") as string || ",";
        const hasHeader = formData.get("hasHeader") === "true";
        const skipRows = parseInt(formData.get("skipRows") as string || "0", 10);
        
        console.log(`[Jobs API] Element column: ${elementColumn || 'not specified'}`);
        console.log(`[Jobs API] Text column: ${textColumn || 'not specified'}`);
        console.log(`[Jobs API] Element template: ${elementTemplate || 'not specified'}`);
        console.log(`[Jobs API] Text template: ${textTemplate || 'not specified'}`);
        console.log(`[Jobs API] Attribute columns: ${attributeColumns.length ? attributeColumns.join(', ') : 'none'}`);
        console.log(`[Jobs API] Delimiter: ${delimiter}, Has header: ${hasHeader}, Skip rows: ${skipRows}`);

        // Get vector set metadata
        const result = await redis.getMetadata(redisResult.url, vectorSetName)
        const metadata = result.result as VectorSetMetadata | null
        
        if (!metadata?.embedding) {
            return NextResponse.json(
                {
                    error: "No embedding configuration found for this vector set",
                    vectorSetName,
                    metadata,
                },
                { status: 400 }
            )
        }

        // Create and start the job
        const jobId = await JobQueueService.createJob(
            redisResult.url,
            file,
            vectorSetName,
            metadata.embedding,
            {
                elementColumn: elementColumn || undefined,
                textColumn: textColumn || undefined,
                elementTemplate: elementTemplate || undefined,
                textTemplate: textTemplate || undefined,
                attributeColumns: attributeColumns.length > 0 ? attributeColumns : undefined,
                delimiter,
                hasHeader,
                skipRows
            }
        )

        // Start processing the job
        const processor = new JobProcessor(redisResult.url, jobId)
        activeProcessors.set(jobId, processor)

        // Start processing in the background
        processor.start().catch((error) => {
            console.error("Job processing error:", error)
            activeProcessors.delete(jobId)
        })

        return NextResponse.json({ success: true, jobId })
    } catch (error) {
        console.error("Error creating job:", error)
        return NextResponse.json(
            {
                error: String(error),
                stack: (error as Error).stack,
            },
            { status: 500 }
        )
    }
}

// Pause/Resume a job
export async function PATCH(req: NextRequest) {
    const url = new URL(req.url)
    const jobId = url.searchParams.get("jobId")
    const action = url.searchParams.get("action")

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

    const redisResult = getRedisUrlOrError()
    if ("error" in redisResult) {
        return NextResponse.json({ error: redisResult.error }, { status: 400 })
    }

    try {
        // Get the processor if it exists
        const processor = activeProcessors.get(jobId)

        if (action === "pause") {
            if (processor) {
                await processor.pause()
            }
            await JobQueueService.pauseJob(redisResult.url, jobId)
        } else {
            if (processor) {
                await processor.resume()
            } else {
                // If no active processor, create a new one and start it
                const newProcessor = new JobProcessor(redisResult.url, jobId)
                activeProcessors.set(jobId, newProcessor)
                newProcessor.start().catch((error) => {
                    console.error("Job processing error:", error)
                    activeProcessors.delete(jobId)
                })
            }
            await JobQueueService.resumeJob(redisResult.url, jobId)
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error(`Error ${action}ing job:`, error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}

// Cancel a specific job
export async function DELETE(req: NextRequest) {
    const url = new URL(req.url)
    const jobId = url.searchParams.get("jobId")

    if (!jobId) {
        return NextResponse.json(
            { error: "Job ID is required" },
            { status: 400 }
        )
    }

    const redisResult = getRedisUrlOrError()
    if ("error" in redisResult) {
        return NextResponse.json({ error: redisResult.error }, { status: 400 })
    }

    try {
        // Stop the processor if it's running
        const processor = activeProcessors.get(jobId)
        if (processor) {
            await processor.stop()
            activeProcessors.delete(jobId)
        }

        // Cancel and clean up the job in Redis
        await JobQueueService.cancelJob(redisResult.url, jobId)
        await JobQueueService.cleanupJob(redisResult.url, jobId)

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Error cancelling job:", error)
        return NextResponse.json({ error: String(error) }, { status: 500 })
    }
}
