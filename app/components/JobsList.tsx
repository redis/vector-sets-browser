"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { JobProgress, CSVJobMetadata } from "@/app/types/job-queue"
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { jobs, type Job } from "@/app/api/jobs"
import { ApiError } from "@/app/api/client"

interface Job {
    jobId: string
    status: JobProgress
    metadata: CSVJobMetadata
}

export default function JobsList({
    jobId,
    onJobComplete,
    onJobError
}: {
    jobId: string
    onJobComplete?: () => void
    onJobError?: (error: string) => void
}) {
    const [job, setJob] = useState<Job | null>(null)
    const [error, setError] = useState<string | null>(null)

    const fetchJobStatus = async () => {
        try {
            const jobData = await jobs.getJob(jobId);
            setJob(jobData);

            if (jobData.status.status === 'completed' && onJobComplete) {
                onJobComplete();
            } else if (jobData.status.status === 'failed' && onJobError) {
                onJobError(jobData.status.error || 'Job failed');
            }
        } catch (error) {
            console.error("Error fetching job status:", error);
            setError(error instanceof ApiError ? error.message : "Error fetching job status");
        }
    };

    const handleJobAction = async (action: 'pause' | 'resume' | 'cancel') => {
        try {
            const updatedJob = await jobs.updateJobStatus(jobId, action);
            setJob(updatedJob);
        } catch (error) {
            console.error("Error updating job status:", error);
            setError(error instanceof ApiError ? error.message : "Error updating job status");
        }
    };

    useEffect(() => {
        const interval = setInterval(fetchJobStatus, 1000);
        return () => clearInterval(interval);
    }, [jobId]);

    if (error) {
        return (
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        )
    }

    if (job === null) {
        return (
            <div className="text-center text-muted-foreground py-4">
                Loading job status...
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <h2 className="uppercase border-t border-black py-4 mt-4 text-sm text-gray-500">
                Import job
            </h2>

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
                                        handleJobAction("pause")
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
                                        handleJobAction("resume")
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
                                    onClick={() => handleJobAction("cancel")}
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
        </div>
    )
} 