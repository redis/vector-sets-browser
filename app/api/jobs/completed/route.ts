import { cleanupOldJobs, CompletedJob, recentlyCompletedJobs } from "@/lib/jobs/completedJobs";
import { NextRequest, NextResponse } from "next/server"


// API route to check for completed jobs
export async function GET(req: NextRequest) {
    let url;
    let since = 0;
    let vectorSetName = null;

    try {
        url = new URL(req.url);
        since = parseInt(url.searchParams.get("since") || "0", 10);
        vectorSetName = url.searchParams.get("vectorSetName");
    } catch (error) {
        console.error("Error parsing URL:", error, "URL:", req.url);
        return NextResponse.json({
            success: false,
            error: `Invalid URL format: ${error instanceof Error ? error.message : String(error)}`
        }, { status: 400 });
    }

    // Clean up old jobs first
    cleanupOldJobs()

    // Filter jobs by time and optional vector set name
    const jobs = recentlyCompletedJobs
        .filter((job: CompletedJob) => job.timestamp > since)
        .filter((job: CompletedJob) => !vectorSetName || job.vectorSetName === vectorSetName)

    return NextResponse.json({
        success: true,
        result: jobs,
        serverTime: Date.now()
    })
} 