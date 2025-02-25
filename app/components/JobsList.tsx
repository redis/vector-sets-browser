"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { JobProgress, CSVJobMetadata } from "@/app/types/job-queue"
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface Job {
    jobId: string
    status: JobProgress
    metadata: CSVJobMetadata
}

export default function JobsList() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [error, setError] = useState<string | null>(null)

    const fetchJobs = async () => {
        try {
            const response = await fetch('/api/jobs')
            if (!response.ok) {
                throw new Error('Failed to fetch jobs')
            }
            const data = await response.json()
            setJobs(data)
        } catch (error) {
            console.error('Error fetching jobs:', error)
            setError('Failed to fetch jobs')
        }
    }

    const cancelJob = async (jobId: string) => {
        try {
            const response = await fetch(`/api/jobs?jobId=${jobId}`, {
                method: 'DELETE',
            })
            if (!response.ok) {
                throw new Error('Failed to cancel job')
            }
            // Refresh the jobs list
            fetchJobs()
        } catch (error) {
            console.error('Error cancelling job:', error)
            setError('Failed to cancel job')
        }
    }

    const pauseResumeJob = async (jobId: string, action: 'pause' | 'resume') => {
        try {
            const response = await fetch(`/api/jobs?jobId=${jobId}&action=${action}`, {
                method: 'PATCH',
            })
            if (!response.ok) {
                throw new Error(`Failed to ${action} job`)
            }
            // Refresh the jobs list
            fetchJobs()
        } catch (error) {
            console.error(`Error ${action}ing job:`, error)
            setError(`Failed to ${action} job`)
        }
    }

    useEffect(() => {
        fetchJobs()
        // Poll for updates every 2 seconds
        const interval = setInterval(fetchJobs, 2000)
        return () => clearInterval(interval)
    }, [])

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )
    }

    if (jobs.length === 0) {
        return (
            <div className="text-center text-muted-foreground py-4">
                No import jobs
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h2 className="uppercase border-t border-black py-4 mt-4 text-sm text-gray-500">
                Import jobs
            </h2>

            {jobs.map((job) => (
                <Card key={job.jobId} className="p-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="font-medium">
                                    {job.metadata.vectorSetName}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {job.metadata.filename}
                                </p>
                            </div>
                            <div className="space-x-2">
                                {job.status.status === "processing" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            pauseResumeJob(job.jobId, "pause")
                                        }
                                    >
                                        Pause
                                    </Button>
                                )}
                                {job.status.status === "paused" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            pauseResumeJob(job.jobId, "resume")
                                        }
                                    >
                                        Resume
                                    </Button>
                                )}
                                {(job.status.status === "processing" ||
                                    job.status.status === "paused" ||
                                    job.status.status === "pending") && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => cancelJob(job.jobId)}
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <div className="text-sm">
                                    {job.status.message || job.status.status}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {job.status.current} of {job.status.total}{" "}
                                    records
                                </div>
                            </div>
                            <Progress
                                value={
                                    (job.status.current / job.status.total) *
                                    100
                                }
                                className="w-full"
                            />
                        </div>

                        {job.status.status === "completed" && (
                            <Alert variant="default" className="mt-2">
                                <CheckCircle2 className="h-4 w-4" />
                                <AlertDescription>
                                    Import completed successfully!
                                </AlertDescription>
                            </Alert>
                        )}

                        {job.status.status === "failed" && (
                            <Alert variant="destructive" className="mt-2">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>
                                    {job.status.error || "Import failed"}
                                </AlertDescription>
                            </Alert>
                        )}

                        {job.status.status === "cancelled" && (
                            <Alert variant="default" className="mt-2">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription>
                                    Import cancelled by user
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    )
} 