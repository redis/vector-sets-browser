// Store last completed job IDs in memory with timestamp
export interface CompletedJob {
    jobId: string
    vectorSetName: string
    timestamp: number
}

// Keep track of recently completed jobs (last 60 seconds)
export const recentlyCompletedJobs: CompletedJob[] = []

// Cleanup old completed jobs periodically
const RETENTION_PERIOD = 60 * 1000 // 60 seconds

// Periodically clean up old jobs
export function cleanupOldJobs() {
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