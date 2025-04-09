import { Job } from "@/app/api/jobs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, XCircle } from "lucide-react"
import { motion } from 'framer-motion'

interface ActiveJobsProps {
    jobs: Job[]
    onPauseJob: (jobId: string) => void
    onResumeJob: (jobId: string) => void
    onCancelJob: (jobId: string) => void
    onForceCleanupJob: (jobId: string) => void
    onRemoveJob: (jobId: string) => void
}

export default function ActiveJobs({
    jobs,
    onPauseJob,
    onResumeJob,
    onCancelJob,
    onForceCleanupJob,
    onRemoveJob,
}: ActiveJobsProps) {
    if (!jobs || jobs.length === 0) {
        return null
    }

    return (
        <div className="space-y-4">
            {jobs.map((job) => (
                <Card key={job.jobId} className="p-4">
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="text-sm text-muted-foreground">
                                    {job.metadata.filename}
                                </p>
                            </div>
                            <div className="space-x-2">
                                {job.status.status === "processing" && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onPauseJob(job.jobId)}
                                    >
                                        Pause
                                    </Button>
                                )}
                                {job.status.status === "paused" && (
                                    <>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onResumeJob(job.jobId)}
                                        >
                                            Resume
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onForceCleanupJob(job.jobId)}
                                        >
                                            Force Cleanup
                                        </Button>
                                    </>
                                )}
                                {(job.status.status === "processing" ||
                                    job.status.status === "paused" ||
                                    job.status.status === "pending") && (
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => onCancelJob(job.jobId)}
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
                                    {job.status.current} of {job.status.total} records
                                </div>
                            </div>
                            <motion.div
                                initial={{ scaleX: 0 }}
                                animate={{ 
                                    scaleX: job.status.current / job.status.total,
                                    transition: { duration: 0.5 }
                                }}
                                className="h-2 bg-primary rounded-full origin-left"
                            />
                        </div>

                        {job.status.status === "completed" && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5 }}
                            >
                                <Alert variant="default" className="mt-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    <AlertDescription className="flex justify-between items-center">
                                        <span>Import completed successfully!</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onForceCleanupJob(job.jobId)}
                                        >
                                            Dismiss
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            </motion.div>
                        )}

                        {job.status.status === "failed" && (
                            <Alert variant="destructive" className="mt-2">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription className="flex justify-between items-center">
                                    <span>{job.status.error || "Import failed"}</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onRemoveJob(job.jobId)}
                                    >
                                        Dismiss
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}

                        {job.status.status === "cancelled" && (
                            <Alert variant="default" className="mt-2">
                                <XCircle className="h-4 w-4" />
                                <AlertDescription className="flex justify-between items-center">
                                    <span>Import cancelled by user</span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onRemoveJob(job.jobId)}
                                    >
                                        Dismiss
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                </Card>
            ))}
        </div>
    )
} 