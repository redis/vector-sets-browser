import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Card } from "@/components/ui/card"
import { JobProgress, CSVJobMetadata, JobStatus } from "@/app/types/job-queue"
import { AlertCircle, CheckCircle2, XCircle, FileSpreadsheet, Database, ArrowLeft } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import ImportFromCSV from "./ImportFromCSV"
import { VectorSetMetadata } from "@/app/types/embedding"

interface Job {
    jobId: string
    status: {
        status: JobStatus
        current: number
        total: number
        message?: string
        error?: string
    }
    metadata: CSVJobMetadata
}

interface ImportTabProps {
    vectorSetName: string
    metadata: VectorSetMetadata | null
}

export default function ImportTab({ vectorSetName, metadata }: ImportTabProps) {
    const [jobs, setJobs] = useState<Job[]>([])
    const [error, setError] = useState<string | null>(null)
    const [showImportCSV, setShowImportCSV] = useState(false)

    const hasActiveJobs = jobs.some(
        (job) =>
            job.status.status === "processing" ||
            job.status.status === "paused" ||
            job.status.status === "pending"
    )

    const fetchJobs = useCallback(async () => {
        try {
            const response = await fetch(
                `/api/jobs?vectorSetName=${encodeURIComponent(vectorSetName)}`
            )
            if (!response.ok) {
                throw new Error("Failed to fetch jobs")
            }
            const data = await response.json()
            setJobs(data)
        } catch (error) {
            console.error("Error fetching jobs:", error)
            setError("Failed to fetch jobs")
        }
    }, [vectorSetName])

    const cancelJob = async (jobId: string) => {
        try {
            const response = await fetch(`/api/jobs?jobId=${jobId}`, {
                method: "DELETE",
            })
            if (!response.ok) {
                throw new Error("Failed to cancel job")
            }
            // Refresh the jobs list
            fetchJobs()
        } catch (error) {
            console.error("Error cancelling job:", error)
            setError("Failed to cancel job")
        }
    }

    const pauseResumeJob = async (
        jobId: string,
        action: "pause" | "resume"
    ) => {
        try {
            const response = await fetch(
                `/api/jobs?jobId=${jobId}&action=${action}`,
                {
                    method: "PATCH",
                }
            )
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
    }, [fetchJobs])

    return (
        <div className="space-y-8">
            <div className="space-y-4">
                {jobs.length === 0 ? (
                    <div className="space-y-6">
                        {showImportCSV ? (
                            <div className="bg-white p-6 rounded-lg shadow-sm">
                                <div className="mb-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowImportCSV(false)}
                                        className="flex items-center gap-2"
                                    >
                                        <ArrowLeft className="h-4 w-4" />
                                        Back
                                    </Button>
                                </div>
                                <ImportFromCSV
                                    onClose={() => setShowImportCSV(false)}
                                    metadata={metadata}
                                    vectorSetName={vectorSetName}
                                />
                            </div>
                        ) : (
                            <div>
                                <h2 className="text-left py-2 text-xl font-medium text-gray-700">
                                    Import Data to your Vector Set
                                </h2>
                                    
                                <p className="p-4">
                                    Lets get some data into your VectorSet! Select an option below.
                                </p>
                                <p className="p-4">
                                    This vector set is configured to use <strong> {metadata?.embedding.provider}</strong> model: <strong>{metadata?.embedding.modelName}</strong>. You can change the embedding engine on the Information tab.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    <Card 
                                        className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                                        onClick={() => setShowImportCSV(true)}
                                    >
                                        <div className="flex flex-col items-center space-y-3">
                                            <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                                            <h3 className="font-medium">Import from CSV</h3>
                                            <p className="text-sm text-gray-500 text-center">
                                                Upload your own CSV file with text data
                                            </p>
                                        </div>
                                    </Card>
                                    <Card className="p-6 cursor-pointer hover:shadow-md transition-shadow">
                                        <div className="flex flex-col items-center space-y-3">
                                            <Database className="h-8 w-8 text-green-500" />
                                            <h3 className="font-medium">Load Sample Data</h3>
                                            <p className="text-sm text-gray-500 text-center">
                                                Try out with our pre-made dataset
                                            </p>
                                        </div>
                                    </Card>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    jobs.map((job) => (
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
                                                onClick={() =>
                                                    pauseResumeJob(
                                                        job.jobId,
                                                        "pause"
                                                    )
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
                                                    pauseResumeJob(
                                                        job.jobId,
                                                        "resume"
                                                    )
                                                }
                                            >
                                                Resume
                                            </Button>
                                        )}
                                        {(job.status.status === "processing" ||
                                            job.status.status === "paused" ||
                                            job.status.status ===
                                                "pending") && (
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                onClick={() =>
                                                    cancelJob(job.jobId)
                                                }
                                            >
                                                Cancel
                                            </Button>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <div className="flex justify-between items-center">
                                        <div className="text-sm">
                                            {job.status.message ||
                                                job.status.status}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                            {job.status.current} of{" "}
                                            {job.status.total} records
                                        </div>
                                    </div>
                                    <Progress
                                        value={
                                            (job.status.current /
                                                job.status.total) *
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
                                    <Alert
                                        variant="destructive"
                                        className="mt-2"
                                    >
                                        <XCircle className="h-4 w-4" />
                                        <AlertDescription>
                                            {job.status.error ||
                                                "Import failed"}
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
                    ))
                )}
            </div>
        </div>
    )
}
