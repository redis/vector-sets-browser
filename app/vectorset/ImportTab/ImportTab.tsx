import { ImportJobConfig, jobs, type ImportLogEntry, type Job } from "@/app/api/jobs"
import { vectorSets } from "@/app/api/vector-sets"
import { getModelName } from "@/app/embeddings/types/embeddingModels"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    ArrowLeft,
    Database,
    FileJson,
    FileSpreadsheet
} from "lucide-react"
import { useCallback, useEffect, useState, useRef } from "react"
import eventBus, { AppEvents } from "@/app/utils/eventEmitter"
import ActiveJobs from "./ActiveJobs"
import ImportFromCSV from "./ImportFromCSV"
import ImportHistory from "./ImportHistory"
import { SampleDataDialog } from "./SampleDataDialog"

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
    const [showImportSample, setShowImportSample] = useState(initialShowSampleData)
    const [showImportSuccessDialog, setShowImportSuccessDialog] = useState(false)
    const [dismissedJobIds, setDismissedJobIds] = useState<Set<string>>(new Set())
    const [importLogs, setImportLogs] = useState<ImportLogEntry[]>([])
    const jsonFileInputRef = useRef<HTMLInputElement>(null)

    // Fetch jobs periodically to show current state
    const fetchJobs = useCallback(async () => {
        try {
            const data = await jobs.getJobsByVectorSet(vectorSetName)
            if (data) {
                const filteredJobs = data.filter(
                    (job) => !dismissedJobIds.has(job.jobId)
                )
                setJobList(filteredJobs)
            }
        } catch (error) {
            console.error("Error fetching jobs:", error)
        }
    }, [vectorSetName, dismissedJobIds])

    // Listen for job status changes
    useEffect(() => {
<<<<<<< HEAD
=======
        const handleJobStatusChange = async (data: {
            vectorSetName: string
            status: string
            jobId: string
        }) => {
            // Only handle events for our vector set
            if (data.vectorSetName !== vectorSetName) return

            console.log(`Job status changed:`, data)
            
            // Show success dialog when a job completes
            if (data.status === "completed") {
                try {
                    // Fetch the completed job details
                    const jobDetails = await jobs.getJob(data.jobId)
                    setSuccessJob(jobDetails)
                    setShowImportSuccessDialog(true)
                    // Refresh import logs when a job completes
                    fetchImportLogs()
                    // Emit the VECTORS_IMPORTED event to refresh counts
                    eventBus.emit(AppEvents.VECTORS_IMPORTED, { vectorSetName })
                } catch (error) {
                    console.error("Error fetching completed job details:", error)
                }
            }
            
            // Refresh job list to show current state
            fetchJobs()
        }

>>>>>>> main
        // Initial fetch
        fetchJobs()
    }, [vectorSetName, fetchJobs])

    const fetchImportLogs = useCallback(async () => {
        try {
            const logs = await jobs.getImportLogs(vectorSetName, 20)
            setImportLogs(logs)
        } catch (error) {
            console.error("Error fetching import logs:", error)
        }
    }, [vectorSetName])

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

    const handleJsonImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!metadata || !event.target.files || event.target.files.length === 0) return;

        const file = event.target.files[0];
        try {
            // Create an import job with the JSON file
            const importJobConfig: ImportJobConfig = {
                fileType: 'json',
                exportType: 'redis', // We want to import to Redis
                metadata: metadata,
                // Let the server determine the appropriate columns and attributes
                // based on the JSON structure
            };

            await jobs.createImportJob(vectorSetName, file, importJobConfig);

            // Clear the file input for future imports
            if (jsonFileInputRef.current) {
                jsonFileInputRef.current.value = '';
            }

            // Emit the VECTORS_IMPORTED event
            eventBus.emit(AppEvents.VECTORS_IMPORTED, { vectorSetName });

            // Fetch jobs to update the UI
            await fetchJobs();

        } catch (error) {
            console.error("Failed to import JSON data:", error);
            // Clear the file input so the user can try again
            if (jsonFileInputRef.current) {
                jsonFileInputRef.current.value = '';
            }
        }
    };

    useEffect(() => {
        const pollInterval = setInterval(fetchJobs, 1000);
        fetchJobs(); // Initial fetch

        return () => clearInterval(pollInterval);
    }, [fetchJobs]);

    // Add effect to fetch import logs periodically
    useEffect(() => {
        const pollLogsInterval = setInterval(fetchImportLogs, 5000);
        fetchImportLogs(); // Initial fetch

        return () => clearInterval(pollLogsInterval);
    }, [fetchImportLogs]);

    // Handle dialog state changes
    const handleImportSuccess = () => {
        setShowImportSuccessDialog(true)
    }

    const handleSuccessDialogClose = () => {
        setShowImportSuccessDialog(false)
        setShowImportCSV(false)  // Close the import dialog when success dialog is closed
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
                    <div className="space-y-4">
                        {!jobList || jobList.length === 0 ? (
                            <div className="space-y-6">
                                {showImportCSV ? (
                                    <div className="bg-[white] p-2 rounded-lg shadow-xs">
                                        <div className="mb-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setShowImportCSV(false)
                                                }
                                                className="flex items-center gap-2"
                                            >
                                                <ArrowLeft className="h-4 w-4" />
                                                Back
                                            </Button>
                                        </div>
                                        <ImportFromCSV
                                            onImportSuccess={handleImportSuccess}
                                            metadata={metadata}
                                            vectorSetName={vectorSetName}
                                        />
                                    </div>
                                ) : showImportSample ? (
                                    <div className="bg-[white] p-2 rounded-lg shadow-xs">
                                        <div className="mb-4">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() =>
                                                    setShowImportSample(false)
                                                }
                                                className="flex items-center gap-2"
                                            >
                                                <ArrowLeft className="h-4 w-4" />
                                                Back
                                            </Button>
                                        </div>
                                        <SampleDataDialog
                                            open={showImportSample}
                                            onOpenChange={(open) => {
                                                setShowImportSample(open)
                                            }}
                                            vectorSetName={vectorSetName}
                                            metadata={metadata}
                                            onImportComplete={(success) => {
                                                console.log("onImportComplete called with success:", success);
                                                fetchJobs();

                                                if (success) {
                                                    console.log("Import was successful, showing success dialog soon");
                                                    setTimeout(async () => {
                                                        try {
                                                            const latestJobs = await jobs.getJobsByVectorSet(vectorSetName);
                                                            console.log("Latest jobs:", latestJobs);
                                                            if (latestJobs && latestJobs.length > 0) {
                                                                // Sort by most recent first using message timestamp if available
                                                                const sortedJobs = [...latestJobs].sort((a, b) => {
                                                                    // Try to extract timestamp from message if available
                                                                    const getTimestamp = (job: Job) => {
                                                                        const timestampMatch = job.status.message?.match(/at (\d+)/);
                                                                        return timestampMatch ? parseInt(timestampMatch[1], 10) : 0;
                                                                    };
                                                                    return getTimestamp(b) - getTimestamp(a);
                                                                });

                                                                const completedJob = sortedJobs.find(j => j.status.status === "completed");
                                                                console.log("Found completed job:", completedJob);

                                                                if (completedJob) {
                                                                    setShowImportSuccessDialog(true);
                                                                    console.log("Success dialog should now be visible");
                                                                }
                                                            }
                                                        } catch (error) {
                                                            console.error("Error fetching latest job:", error);
                                                        }
                                                    }, 1000);
                                                }
                                            }}
                                            onUpdateMetadata={async (
                                                newMetadata
                                            ) => {
                                                console.log(
                                                    "Updating metadata:",
                                                    newMetadata
                                                )
                                                try {
                                                    await vectorSets.setMetadata({
                                                        name: vectorSetName,
                                                        metadata: newMetadata
                                                    })
                                                    window.location.reload()
                                                } catch (error) {
                                                    console.error(
                                                        "Failed to update metadata:",
                                                        error
                                                    )
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <p className="py-4">
                                            Import your data into this Vector
                                            Set to get started.
                                        </p>
                                        <p className="py-4">
                                            This vector set is configured to use{" "}
                                            <strong>
                                                {" "}
                                                {metadata?.embedding.provider}
                                            </strong>{" "}
                                            model:{" "}
                                            <strong>
                                                {metadata
                                                    ? getModelName(
                                                        metadata.embedding
                                                    )
                                                    : "Unknown"}
                                            </strong>
                                            . You can change the embedding
                                            engine on the Information tab.
                                        </p>
                                        <div className="grid grid-cols-3 gap-4">
                                            <Card
                                                className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                                                onClick={() =>
                                                    setShowImportCSV(true)
                                                }
                                            >
                                                <div className="flex flex-col items-center space-y-3">
                                                    <FileSpreadsheet className="h-8 w-8 text-blue-500" />
                                                    <h3 className="font-medium">
                                                        Import from CSV
                                                    </h3>
                                                    <p className="text-sm text-gray-500 text-center">
                                                        Upload your own CSV file
                                                        with text data
                                                    </p>
                                                </div>
                                            </Card>
                                            <Card
                                                className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                                                onClick={() =>
                                                    setShowImportSample(true)
                                                }
                                            >
                                                <div className="flex flex-col items-center space-y-3">
                                                    <Database className="h-8 w-8 text-green-500" />
                                                    <h3 className="font-medium">
                                                        Sample Data
                                                    </h3>
                                                    <p className="text-sm text-gray-500 text-center">
                                                        Import pre-configured
                                                        datasets with one click
                                                    </p>
                                                </div>
                                            </Card>
                                            <Card
                                                className="p-6 cursor-pointer hover:shadow-md transition-shadow"
                                                onClick={() => jsonFileInputRef.current?.click()}
                                            >
                                                <div className="flex flex-col items-center space-y-3">
                                                    <FileJson className="h-8 w-8 text-purple-500" />
                                                    <h3 className="font-medium">
                                                        Import JSON
                                                    </h3>
                                                    <p className="text-sm text-gray-500 text-center">
                                                        Import test data from JSON
                                                    </p>
                                                </div>
                                            </Card>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <ActiveJobs
                                jobs={jobList}
                                onPauseJob={pauseJob}
                                onResumeJob={resumeJob}
                                onCancelJob={cancelJob}
                                onForceCleanupJob={forceCleanupJob}
                                onRemoveJob={removeJob}
                            />
                        )}
                    </div>
                </CardContent>
            </Card>

            <ImportHistory importLogs={importLogs} />

            <Dialog
                open={showImportSuccessDialog}
                onOpenChange={handleSuccessDialogClose}
            >
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Import Started Successfully</DialogTitle>
                        <DialogDescription>
                            Your data import has started. For large files this may take a long time.
                            You can see the import status and pause/cancel on the vectorset list.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="mt-4 flex justify-end">
                        <Button
                            variant="secondary"
                            onClick={handleSuccessDialogClose}
                        >
                            Close
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            <input
                type="file"
                ref={jsonFileInputRef}
                onChange={handleJsonImport}
                accept=".json"
                className="hidden"
            />
        </div>
    )
}
