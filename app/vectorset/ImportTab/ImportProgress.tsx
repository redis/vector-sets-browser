import { Job } from "@/app/api/jobs"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Ban, Pause, Play, XCircle } from "lucide-react"

interface ImportProgressProps {
    jobs: Job[]
    onPauseJob: (jobId: string) => void
    onResumeJob: (jobId: string) => void
    onCancelJob: (jobId: string) => void
    onForceCleanupJob: (jobId: string) => void
    onRemoveJob: (jobId: string) => void
}

export default function ImportProgress({
    jobs,
    onPauseJob,
    onResumeJob,
    onCancelJob,
    onForceCleanupJob,
    onRemoveJob,
}: ImportProgressProps) {
    return (
        <div className="space-y-4">
            {jobs.map((job) => {
                const progress = Math.round(
                    (job.status.current / job.status.total) * 100
                )
                const isPaused = job.status.status === "paused"
                const isFailed = job.status.status === "failed"
                const isCompleted = job.status.status === "completed"
                const isCancelled = job.status.status === "cancelled"

                return (
                    <Card key={job.jobId}>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-base">
                                    Importing {job.metadata.filename}
                                </CardTitle>
                                <div className="flex gap-2">
                                    {!isCompleted && !isFailed && !isCancelled && (
                                        <>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    isPaused
                                                        ? onResumeJob(job.jobId)
                                                        : onPauseJob(job.jobId)
                                                }
                                            >
                                                {isPaused ? (
                                                    <Play className="h-4 w-4" />
                                                ) : (
                                                    <Pause className="h-4 w-4" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    onCancelJob(job.jobId)
                                                }
                                            >
                                                <Ban className="h-4 w-4" />
                                            </Button>
                                        </>
                                    )}
                                    {(isCompleted ||
                                        isFailed ||
                                        isCancelled) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                onRemoveJob(job.jobId)
                                            }
                                        >
                                            <XCircle className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Progress value={progress} />
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span>
                                        {job.status.current} of{" "}
                                        {job.status.total} records
                                    </span>
                                    <span>{progress}%</span>
                                </div>
                                {job.status.message && (
                                    <p className="text-sm text-muted-foreground">
                                        {job.status.message}
                                    </p>
                                )}
                                {job.status.error && (
                                    <p className="text-sm text-red-500">
                                        {job.status.error}
                                    </p>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
} 