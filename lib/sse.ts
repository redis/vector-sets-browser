import { AppEvents } from "@/app/utils/eventEmitter"
import eventBus from "@/app/utils/eventEmitter"

// Event source for Server-Sent Events
let eventSource: EventSource | null = null
let isConnecting = false
let reconnectAttempts = 0
const MAX_RECONNECT_ATTEMPTS = 5
const RECONNECT_DELAY = 2000 // 2 seconds

// Fallback polling state
let pollingInterval: NodeJS.Timeout | null = null
let lastPollTime = 0
const POLLING_INTERVAL = 5000 // 5 seconds

/**
 * Initialize real-time updates using Server-Sent Events
 */
export function initSocket() {
    if (eventSource || isConnecting) return

    if (!window.EventSource) {
        console.warn(
            "EventSource not supported in this browser, falling back to polling"
        )
        startPolling()
        return
    }

    isConnecting = true

    try {
        const sseUrl = `/api/sse`
        console.log("Connecting to SSE endpoint:", sseUrl)

        eventSource = new EventSource(sseUrl)

        eventSource.onopen = () => {
            console.log("Server-Sent Events connection established")
            isConnecting = false
            reconnectAttempts = 0

            // Stop polling if we have a successful SSE connection
            stopPolling()
        }

        // Set up listeners for different event types
        Object.values(AppEvents).forEach((eventType) => {
            eventSource?.addEventListener(eventType, (event) => {
                try {
                    const data = JSON.parse(event.data)
                    console.log(`Received ${eventType} event:`, data)
                    eventBus.emit(eventType as AppEvents, data)
                } catch (error) {
                    console.error(`Error processing ${eventType} event:`, error)
                }
            })
        })

        // Handle generic messages
        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data)
                if (data.type && Object.values(AppEvents).includes(data.type)) {
                    eventBus.emit(data.type as AppEvents, data.payload)
                }
            } catch (error) {
                console.error("Error processing SSE message:", error)
            }
        }

        eventSource.onerror = (error) => {
            console.error("SSE connection error:", error)
            isConnecting = false

            if (eventSource) {
                eventSource.close()
                eventSource = null
            }

            // Start polling on error
            startPolling()

            // Attempt to reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++
                setTimeout(() => {
                    console.log(
                        `Attempting to reconnect SSE (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`
                    )
                    initSocket()
                }, RECONNECT_DELAY * reconnectAttempts) // Exponential backoff
            } else {
                console.warn(
                    "Max SSE reconnection attempts reached, using polling fallback."
                )
            }
        }
    } catch (error) {
        console.error("Failed to connect to SSE:", error)
        isConnecting = false
        startPolling()
    }
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
    if (eventSource) {
        eventSource.close()
        eventSource = null
    }

    stopPolling()
}
