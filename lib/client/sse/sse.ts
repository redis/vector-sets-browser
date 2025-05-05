import { AppEvents } from "@/lib/client/events/eventEmitter"
import eventBus from "@/lib/client/events/eventEmitter"

// Fallback polling state
let pollingInterval: NodeJS.Timeout | null = null
let lastPollTime = 0
const POLLING_INTERVAL = 2000 // 1.5 seconds to match previous interval

/**
 * Initialize real-time updates using Server-Sent Events
 */
export function initSocket() {
    if (pollingInterval) return
    startPolling()
}

/**
 * Subscribe to events (via event bus, which gets updates from SSE or polling)
 */
export function subscribe(
    eventType: AppEvents,
    handler: (payload: any) => void
): () => void {
    // Subscribe to the event bus
    const unsubscribe = eventBus.on(eventType, handler)

    // Ensure communication is initialized
    initSocket()

    return unsubscribe
}

/**
 * Start polling for updates as fallback when SSE isn't available
 */
function startPolling() {
    if (pollingInterval) return // Already polling

    console.log("Starting polling fallback")
    lastPollTime = Date.now()

    pollingInterval = setInterval(() => {
        console.log("Polling for job updates...")
        // Poll for job updates
        fetch(`/api/jobs/completed?since=${lastPollTime}`)
            .then((response) => response.json())
            .then((data) => {
                if (data.success && data.result.length > 0) {
                    console.log("Poll detected completed jobs:", data.result)

                    // Emit events for each completed job
                    data.result.forEach((job: any) => {
                        eventBus.emit(AppEvents.JOB_STATUS_CHANGED, {
                            vectorSetName: job.vectorSetName,
                            status: "completed",
                            jobId: job.jobId,
                        })
                    })
                }

                // Update the last poll time
                lastPollTime = data.serverTime || Date.now()
            })
            .catch((error) => {
                console.error("Error polling for updates:", error)
            })

        // Poll for active jobs
        fetch("/api/jobs")
            .then((response) => response.json())
            .then((data) => {
                if (data.success) {
                    // Group jobs by vector set and status
                    const jobsByVectorSet: Record<
                        string,
                        Record<string, number>
                    > = {}

                    data.result.forEach((job: any) => {
                        const vectorSetName = job.metadata.vectorSetName
                        const status = job.status.status

                        if (!jobsByVectorSet[vectorSetName]) {
                            jobsByVectorSet[vectorSetName] = {}
                        }

                        if (!jobsByVectorSet[vectorSetName][status]) {
                            jobsByVectorSet[vectorSetName][status] = 0
                        }

                        jobsByVectorSet[vectorSetName][status]++
                    })

                    // Emit events for each vector set with active jobs
                    Object.keys(jobsByVectorSet).forEach((vectorSetName) => {
                        Object.keys(jobsByVectorSet[vectorSetName]).forEach(
                            (status) => {
                                if (
                                    status === "processing" ||
                                    status === "paused" ||
                                    status === "pending"
                                ) {
                                    eventBus.emit(
                                        AppEvents.JOB_STATUS_CHANGED,
                                        {
                                            vectorSetName,
                                            status,
                                            jobId: "polling", // We don't know the specific job ID when polling
                                        }
                                    )
                                }
                            }
                        )
                    })
                }
            })
            .catch((error) => {
                console.error("Error polling for active jobs:", error)
            })
    }, POLLING_INTERVAL)
}

/**
 * Stop polling fallback
 */
function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval)
        pollingInterval = null
        console.log("Stopped polling fallback")
    }
}

/**
 * Close SSE connection and stop polling
 */
export function closeSocket() {
    stopPolling()
}
