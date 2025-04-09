import {
    ImportJobConfig,
    jobs,
    type ImportLogEntry,
    type Job,
} from "@/app/api/jobs"
import { getModelName } from "@/app/embeddings/types/embeddingModels"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import eventBus, { AppEvents } from "@/app/utils/eventEmitter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { subscribe } from "@/lib/sse"
import { useCallback, useEffect, useRef, useState } from "react"
import ImportFromCSVFlow from "./CSV/ImportFromCSVFlow"
import ImportHistory from "./ImportHistory"
import ImportJSONFlow from "./JSON/ImportJSONFlow"
import ImportProgress from "./ImportProgress"
import ImportSamplesFlow from "./Samples/ImportSamplesFlow"

interface ImportTabProps {
    vectorSetName: string
    metadata: VectorSetMetadata | null
    initialShowSampleData?: boolean
}

export default function ImportTab({
    vectorSetName,
    metadata,
    initialShowSampleData = false,
}: ImportTabProps) {
    const [jobList, setJobList] = useState<Job[]>([])
    const [showImportCSV, setShowImportCSV] = useState(false)
    const [showImportSample, setShowImportSample] = useState(
        initialShowSampleData
    )
    const [showImportSuccessDialog, setShowImportSuccessDialog] =
        useState(false)
    const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(
        new Set()
    )
    const [importLogs, setImportLogs] = useState<ImportLogEntry[]>([])
    const jsonFileInputRef = useRef<HTMLInputElement>(null)
    const [pollingInterval, setPollingInterval] = useState<number>(5000)
    const lastUpdateTimeRef = useRef<Record<string, number>>({})

    const fetchImportLogs = useCallback(async () => {
        try {
            const logs = await jobs.getImportLogs(vectorSetName, 20)
            setImportLogs(logs)
        } catch (error) {
            console.error("Error fetching import logs:", error)
        }
    }, [vectorSetName])

    // Enhanced job fetching with dynamic polling
    const fetchJobs = useCallback(async () => {
        try {
            const data = await jobs.getJobsByVectorSet(vectorSetName)
            if (data) {
                const filteredJobs = data.filter(
                    (job) => !dismissedJobIds.has(job.jobId)
                )

                // Track active jobs and adjust polling frequency
                const activeJobs = filteredJobs.filter(
                    (job) => job.status.status === "processing"
                )

                // If we have active jobs, increase polling frequency and emit progress
                if (activeJobs.length > 0) {
                    if (pollingInterval > 1000) {
                        setPollingInterval(1000) // Poll every second during active imports
                    }

                    // Emit event to update the import progress, but throttle it
                    // We use a ref to store last update times
                    activeJobs.forEach(job => {
                        const now = Date.now()
                        const lastUpdate = lastUpdateTimeRef.current[job.jobId] || 0
                        // Only emit if more than 2 seconds have passed since last update
                        if (now - lastUpdate > 2000) {
                            eventBus.emit(AppEvents.VECTORS_IMPORTED, {
                                vectorSetName,
                            })
                            // Update the last update time
                            lastUpdateTimeRef.current[job.jobId] = now
                        }
                    })
                } else if (pollingInterval === 1000) {
                    setPollingInterval(5000) // Return to normal polling when no active imports
                }

                // Check for newly completed jobs
                const completedJobs = filteredJobs.filter(
                    (job) =>
                        job.status.status === "completed" &&
                        !dismissedJobIds.has(job.jobId)
                )

                if (completedJobs.length > 0) {
                    // Show success dialog for the most recent completion
                    const latestCompletedJob = completedJobs[0]
                    setSuccessJob(latestCompletedJob)
                    setShowImportSuccessDialog(true)

                    // Update import logs
                    await fetchImportLogs()
                }

                setJobList(filteredJobs)
            }
        } catch (error) {
            console.error("Error fetching jobs:", error)
            setError("Failed to fetch jobs")
        }
    }, [vectorSetName, dismissedJobIds, pollingInterval, fetchImportLogs])

    // Use dynamic polling interval
    useEffect(() => {
        const interval = setInterval(fetchJobs, pollingInterval)
        return () => clearInterval(interval)
    }, [fetchJobs, pollingInterval])

    // Listen for job status changes
    useEffect(() => {
        const unsubscribe = subscribe(
            AppEvents.JOB_STATUS_CHANGED,
            async (data) => {
                if (data.vectorSetName === vectorSetName) {
                    await fetchJobs()
                }
            }
        )
        return () => unsubscribe()
    }, [vectorSetName, fetchJobs])

    // Subscribe to vector imports if needed
    useEffect(() => {
        const unsubscribe = subscribe(
            AppEvents.VECTORS_IMPORTED,
            async (data) => {
                if (data.vectorSetName === vectorSetName) {
                    await fetchJobs()
                }
            }
        )
        return () => unsubscribe()
    }, [vectorSetName, fetchJobs])

    // Add effect to fetch import logs periodically
    useEffect(() => {
        // Initial fetch
        fetchImportLogs()

        // Set up periodic fetching
        const interval = setInterval(fetchImportLogs, 5000)

        return () => clearInterval(interval)
    }, [fetchImportLogs])

    // Update logs when jobs complete
    useEffect(() => {
        const unsubscribe = subscribe(
            AppEvents.JOB_STATUS_CHANGED,
            async (data) => {
                if (
                    data.vectorSetName === vectorSetName &&
                    data.status === "completed"
                ) {
                    await fetchImportLogs()
                }
            }
        )
        return () => unsubscribe()
    }, [vectorSetName, fetchImportLogs])

    const cancelJob = async (jobId: string) => {
        try {
            jobs.cancelJob(jobId)
            fetchJobs()
        } catch (error) {
            console.error("Error cancelling job:", error)
        }
    }

    const pauseJob = async (jobId: string) => {
        try {
            await jobs.pauseJob(jobId)
            // Add a timestamp to track when the job was paused
            const timestamp = new Date().getTime()
            console.log(`Job ${jobId} paused at ${timestamp}`)
            // Refresh the jobs list
            fetchJobs()
        } catch (error) {
            console.error(`Error pausing job:`, error)
        }
    }

    const resumeJob = async (jobId: string) => {
        try {
            await jobs.resumeJob(jobId)
            // Refresh the jobs list
            fetchJobs()
        } catch (error) {
            console.error(`Error resuming job:`, error)
        }
    }

    const removeJob = (jobId: string) => {
        setDismissedJobIds((prevIds) => {
            const newIds = new Set(prevIds)
            newIds.add(jobId)
            return newIds
        })
        setJobList((prevJobs) => prevJobs.filter((job) => job.jobId !== jobId))
    }

    const forceCleanupJob = async (jobId: string) => {
        try {
            // Force cancel the job
            await jobs.cancelJob(jobId)
            // Remove it from the UI
            removeJob(jobId)
        } catch (error) {
            console.error("Error force cleaning job:", error)
        }
    }

    const handleJsonImport = async (
        event: React.ChangeEvent<HTMLInputElement>
    ) => {
        if (!metadata || !event.target.files || event.target.files.length === 0)
            return

        const file = event.target.files[0]
        try {
            // Read and parse the JSON to validate it and extract vectors
            const jsonContent = await file.text()
            const jsonData = JSON.parse(jsonContent)

            // Create an import job with the JSON file
            const importJobConfig: ImportJobConfig = {
                fileType: "json",
                exportType: "redis", // We want to import to Redis
                metadata: metadata,
                // Let the server determine the appropriate columns and attributes
                // based on the JSON structure
            }

            await jobs.createImportJob(vectorSetName, file, importJobConfig)

            // Clear the file input for future imports
            if (jsonFileInputRef.current) {
                jsonFileInputRef.current.value = ""
            }

            // Emit the VECTORS_IMPORTED event
            eventBus.emit(AppEvents.VECTORS_IMPORTED, { vectorSetName })

            // Fetch jobs to update the UI
            await fetchJobs()
        } catch (error) {
            console.error("Failed to import JSON data:", error)
            setError(
                error instanceof Error
                    ? error.message
                    : "Failed to import JSON file"
            )
            // Clear the file input so the user can try again
            if (jsonFileInputRef.current) {
                jsonFileInputRef.current.value = ""
            }
        }
    }

    // Handle dialog state changes
    const handleImportSuccess = () => {
        // Show the success dialog without closing the import dialog
        setShowImportSuccessDialog(true)
    }

    const handleSuccessDialogClose = () => {
        setShowImportSuccessDialog(false)
        // Make sure all import dialogs are closed
        setShowImportCSV(false)
        setShowImportSample(false)
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Import Data</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    {jobList.length > 0 ? (
                        <ImportProgress
                            jobs={jobList}
                            onPauseJob={pauseJob}
                            onResumeJob={resumeJob}
                            onCancelJob={cancelJob}
                            onForceCleanupJob={forceCleanupJob}
                            onRemoveJob={removeJob}
                        />
                    ) : (
                        <div>
                            <p className="py-4">
                                Import your data into this Vector Set to get
                                started.
                            </p>
                            <p className="py-4">
                                This vector set is configured to use{" "}
                                <strong>{metadata?.embedding.provider}</strong>{" "}
                                model:{" "}
                                <strong>
                                    {metadata
                                        ? getModelName(metadata.embedding)
                                        : "Unknown"}
                                </strong>
                                . You can change the embedding engine on the
                                Information tab.
                            </p>
                            <div className="grid grid-cols-3 gap-4">
                                <ImportFromCSVFlow
                                    metadata={metadata}
                                    vectorSetName={vectorSetName}
                                    onImportSuccess={handleImportSuccess}
                                />
                                <ImportSamplesFlow
                                    metadata={metadata}
                                    vectorSetName={vectorSetName}
                                    onImportSuccess={handleImportSuccess}
                                    onFetchJobs={fetchJobs}
                                />
                                <ImportJSONFlow
                                    metadata={metadata}
                                    vectorSetName={vectorSetName}
                                    onImportSuccess={handleImportSuccess}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <ImportHistory importLogs={importLogs} />

            <input
                type="file"
                ref={jsonFileInputRef}
                onChange={handleJsonImport}
                accept=".json"
                className="hidden"
            />
        </div >
    )
}
