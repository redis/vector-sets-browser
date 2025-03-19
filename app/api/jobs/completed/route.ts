import { NextRequest, NextResponse } from "next/server"
import RedisClient, * as redis from "@/app/redis-server/server/commands"

// Store last completed job IDs in memory with timestamp
interface CompletedJob {
    jobId: string
    vectorSetName: string
    timestamp: number
}

// Keep track of recently completed jobs (last 60 seconds)
const recentlyCompletedJobs: CompletedJob[] = []

// Cleanup old completed jobs periodically
const RETENTION_PERIOD = 60 * 1000 // 60 seconds

// Periodically clean up old completed jobs
function cleanupOldJobs() {
    const now = Date.now()
    const cutoff = now - RETENTION_PERIOD
    
    // Remove jobs older than the retention period
    while (recentlyCompletedJobs.length > 0 && recentlyCompletedJobs[0].timestamp < cutoff) {
        recentlyCompletedJobs.shift()
    }
}

// Register a completed job
export function registerCompletedJob(jobId: string, vectorSetName: string) {
    // Clean up old jobs first
    cleanupOldJobs()
    
    // Add the new job
    recentlyCompletedJobs.push({
        jobId,
        vectorSetName,
        timestamp: Date.now()
    })
}

// API route to check for completed jobs
export async function GET(req: NextRequest) {
    const url = new URL(req.url)
    const since = parseInt(url.searchParams.get("since") || "0", 10)
    const vectorSetName = url.searchParams.get("vectorSetName")
    
    // Clean up old jobs first
    cleanupOldJobs()
    
    // Filter jobs by time and optional vector set name
    const jobs = recentlyCompletedJobs
        .filter(job => job.timestamp > since)
        .filter(job => !vectorSetName || job.vectorSetName === vectorSetName)
    
    return NextResponse.json({
        success: true,
        result: jobs,
        serverTime: Date.now()
    })
} 