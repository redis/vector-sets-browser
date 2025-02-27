import { useState, useEffect } from "react"
import { VectorSetMetadata } from "@/app/types/embedding"
import EditEmbeddingConfigModal from "./EditEmbeddingConfigModal"
import CreateVectorSetModal from "./CreateVectorSetModal"

import {
    estimateVectorSetMemoryUsage,
    formatBytes,
} from "@/app/utils/vectorSetMemory"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarHeader, SidebarContent } from "@/components/ui/sidebar"

interface VectorSetNavProps {
    redisUrl: string | null
    selectedVectorSet: string | null
    onVectorSetSelect: (vectorSet: string | null) => void
    onRedisUrlChange: (url: string) => void
    onConnect: (url: string) => Promise<boolean>
    onBack: () => void
    isConnected: boolean
}

interface VectorSetInfo {
    name: string
    memoryBytes: number
    dimensions: number
    vectorCount: number
    activeJobs: number
}

interface Job {
    jobId: string
    status: {
        status: 'processing' | 'paused' | 'pending' | 'completed' | 'failed' | 'cancelled'
        current: number
        total: number
        message?: string
        error?: string
    }
    metadata: {
        vectorSetName: string
        filename: string
    }
}

export default function VectorSetNav({
    redisUrl,
    selectedVectorSet,
    onVectorSetSelect,
    onRedisUrlChange,
    onConnect,
    onBack,
    isConnected
}: VectorSetNavProps) {
    const [vectorSets, setVectorSets] = useState<string[]>([])
    const [vectorSetInfo, setVectorSetInfo] = useState<Record<string, VectorSetInfo>>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [editingVectorSet, setEditingVectorSet] = useState<string | null>(null)
    const [isInitialLoad, setIsInitialLoad] = useState(true)

    // Function to fetch jobs for a vector set
    const fetchVectorSetJobs = async (set: string): Promise<number> => {
        try {
            const response = await fetch(`/api/jobs?vectorSetName=${encodeURIComponent(set)}`)
            if (!response.ok) {
                console.error('Failed to fetch jobs:', response.statusText)
                return 0
            }
            const jobs = await response.json() as Job[]
            return jobs.filter((job) => 
                job.status.status === 'processing' || 
                job.status.status === 'paused' || 
                job.status.status === 'pending'
            ).length
        } catch (error) {
            console.error('Error fetching jobs:', error)
            return 0
        }
    }

    const fetchVectorSets = async () => {
        console.log('Fetching vector sets...');
        if (!redisUrl || !isConnected) {
            console.log('No URL or not connected, skipping fetch');
            return
        }

        setLoading(true)
        setError(null)
        try {
            let response = await fetch("/api/redis", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "scanVectorSets",
                    params: {},
                }),
            })
            
            // Handle 401 specifically
            if (response.status === 401) {
                console.log('Not authorized, connection might not be ready');
                // Retry after a delay
                await new Promise(resolve => setTimeout(resolve, 1000));
                response = await fetch("/api/redis", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        action: "scanVectorSets",
                        params: {},
                    }),
                })
                if (!response.ok) {
                    throw new Error("Failed to fetch vector sets after retry")
                }
            } else if (!response.ok) {
                throw new Error("Failed to fetch vector sets")
            }
            
            const data = await response.json()
            
            if (!data.success) {
                throw new Error(data.error || "Failed to fetch vector sets")
            }
            
            const sets = Array.isArray(data.result) ? data.result : []
            setVectorSets(sets)

            // Fetch info for each vector set
            const info: Record<string, VectorSetInfo> = {}
            
            const fetchVectorSetInfo = async (set: string, retryCount = 0): Promise<void> => {
                try {
                    const [dimResponse, cardResponse] = await Promise.all([
                        fetch("/api/redis", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                action: "vdim",
                                params: { keyName: set },
                            }),
                        }),
                        fetch("/api/redis", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                action: "vcard",
                                params: { keyName: set },
                            }),
                        }),
                    ])

                    const [dimData, cardData] = await Promise.all([
                        dimResponse.json(),
                        cardResponse.json(),
                    ])

                    if (!dimResponse.ok || !cardResponse.ok) {
                        throw new Error("Failed to fetch vector set info")
                    }

                    if (!dimData.success || !cardData.success) {
                        throw new Error(dimData.error || cardData.error || "Failed to fetch vector set info")
                    }

                    const dimensions = dimData.result
                    const vectorCount = cardData.result

                    // Validate the results
                    if (typeof dimensions !== 'number' || typeof vectorCount !== 'number') {
                        console.error('Invalid dimensions or vector count:', { dimensions, vectorCount });
                        throw new Error('Invalid vector set info returned from server')
                    }

                    // Calculate estimated memory usage
                    const memoryBytes = estimateVectorSetMemoryUsage(
                        dimensions,
                        vectorCount
                    )

                    // Fetch active jobs count
                    const activeJobs = await fetchVectorSetJobs(set)

                    info[set] = {
                        name: set,
                        memoryBytes,
                        dimensions,
                        vectorCount,
                        activeJobs
                    }

                } catch (error) {
                    console.error(`Error fetching info for vector set ${set}:`, error);
                    if (retryCount < 2) { // Retry up to 2 times
                        console.log(`Retrying fetch for ${set}...`);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second before retrying
                        return fetchVectorSetInfo(set, retryCount + 1);
                    }
                    // If all retries fail, set default values
                    info[set] = {
                        name: set,
                        memoryBytes: 0,
                        dimensions: 0,
                        vectorCount: 0,
                        activeJobs: 0
                    }
                }
            }

            // Fetch info for all sets with retries
            await Promise.all(sets.map((set: string) => fetchVectorSetInfo(set)));

            setVectorSetInfo(info)
        } catch (error) {
            console.error("Error fetching vector sets:", error)
            setError(error instanceof Error ? error.message : "Failed to fetch vector sets")
            setVectorSets([])
            setVectorSetInfo({})
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (isConnected && redisUrl) {
            console.log('Connected and have URL, waiting before fetching vector sets...');
            // Add a small delay to ensure cookie is set
            const timer = setTimeout(() => {
                fetchVectorSets()
                setIsInitialLoad(true)
            }, 500)
            
            return () => clearTimeout(timer)
        } else {
            console.log('Not connected or no URL, clearing vector sets...');
            setVectorSets([])
            setVectorSetInfo({})
            setIsInitialLoad(true)
        }
    }, [redisUrl, isConnected])

    useEffect(() => {
        if (isInitialLoad && vectorSets.length > 0 && !selectedVectorSet) {
            onVectorSetSelect(vectorSets[0])
            setIsInitialLoad(false)
        }
    }, [vectorSets, selectedVectorSet, onVectorSetSelect, isInitialLoad])

    // Clear status message after delay
    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null)
            }, 5000) // Clear after 5 seconds

            return () => clearTimeout(timer)
        }
    }, [statusMessage])

    const handleBasicCreateVectorSet = async (
        name: string,
        dimensions: number,
        metadata: VectorSetMetadata,
        customData?: { element: string; vector: number[] }
    ) => {
        setStatusMessage("Creating vector set...")
        try {
            const response = await fetch("/api/redis", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "createVectorSet",
                    params: {
                        keyName: name,
                        dimensions,
                        metadata,
                        customData,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to create vector set")
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || "Failed to create vector set")
            }

            // Set metadata
            const metadataResponse = await fetch("/api/redis", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "setMetadata",
                    params: {
                        keyName: name,
                        metadata,
                    },
                }),
            })

            if (!metadataResponse.ok) {
                throw new Error("Failed to set vector set metadata")
            }

            const metadataData = await metadataResponse.json()
            if (!metadataData.success) {
                throw new Error(metadataData.error || "Failed to set vector set metadata")
            }

            setStatusMessage("Vector set created successfully")
            setIsCreateModalOpen(false)
            fetchVectorSets()
        } catch (error) {
            console.error("Error creating vector set:", error)
            setStatusMessage(error instanceof Error ? error.message : "Failed to create vector set")
        }
    }

    const handleDeleteVectorSet = async (name: string) => {
        // Add confirmation dialog
        const confirmed = window.confirm(`Are you sure you want to delete the vector set "${name}"?`)
        if (!confirmed) {
            return
        }

        setStatusMessage("Deleting vector set...")
        try {
            const response = await fetch("/api/redis", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "deleteVectorSet",
                    params: {
                        keyName: name,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to delete vector set")
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || "Failed to delete vector set")
            }

            setStatusMessage("Vector set deleted successfully")
            if (selectedVectorSet === name) {
                onVectorSetSelect(null)
            }
            fetchVectorSets()
        } catch (error) {
            console.error("Error deleting vector set:", error)
            setStatusMessage(error instanceof Error ? error.message : "Failed to delete vector set")
        }
    }

    const handleSaveConfig = async (
        vectorSetName: string,
        metadata: VectorSetMetadata
    ) => {
        setStatusMessage("Saving configuration...")
        try {
            const response = await fetch("/api/redis", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "setMetadata",
                    params: {
                        keyName: vectorSetName,
                        metadata,
                    },
                }),
            })

            if (!response.ok) {
                throw new Error("Failed to save configuration")
            }

            const data = await response.json()
            if (!data.success) {
                throw new Error(data.error || "Failed to save configuration")
            }

            setStatusMessage("Configuration saved successfully")
            setIsEditConfigModalOpen(false)
            setEditingVectorSet(null)
            fetchVectorSets()
        } catch (error) {
            console.error("Error saving configuration:", error)
            setStatusMessage(error instanceof Error ? error.message : "Failed to save configuration")
        }
    }

    return (
        <Sidebar>
            <SidebarHeader>
                <div className="flex items-center -ml-4">
                    <Button variant="ghost" onClick={onBack}>
                        <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                            />
                        </svg>
                        {redisUrl}
                    </Button>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <div className="list-container">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-sm font-semibold uppercase text-gray-600">
                            Vector Sets
                        </h2>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                onClick={() => setIsCreateModalOpen(true)}
                                title="Quick Create Vector Set"
                                className="p-1"
                            >
                                <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                            </Button>
                        </div>
                    </div>
                    {loading && (
                        <div className="text-sm text-gray-500">Loading...</div>
                    )}
                    {error && (
                        <div className="text-sm text-red-500 mb-4 p-2 bg-red-50 rounded border border-red-200">
                            {error}
                        </div>
                    )}
                    {statusMessage && (
                        <div className="text-sm text-green-600 mb-4 p-2 bg-green-50 rounded border border-green-200">
                            {statusMessage}
                        </div>
                    )}
                    {!loading && !error && vectorSets.length === 0 && (
                        <div className="text-sm text-gray-500">
                            No vector sets found
                        </div>
                    )}
                    {vectorSets.map((vectorSet, index) => {
                        const info = vectorSetInfo[vectorSet]
                        return (
                            <div
                                key={vectorSet}
                                className={`group list-item relative ${
                                    selectedVectorSet === vectorSet
                                        ? "list-item-selected"
                                        : index % 2 === 0
                                        ? "list-item-alt"
                                        : "list-item-default"
                                }`}
                            >
                                <div
                                    onClick={() => onVectorSetSelect(vectorSet)}
                                    className="list-item-content truncate"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="truncate overflow-hidden whitespace-nowrap min-w-0"
                                            title={vectorSet}
                                        >
                                            {vectorSet}
                                        </span>
                                        {info?.activeJobs > 0 && (
                                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded">
                                                {info.activeJobs}
                                            </span>
                                        )}
                                    </div>
                                    {info && (
                                        <div className="flex w-full justify-between text-xs">
                                            <span>
                                                {info.vectorCount.toLocaleString()}{" "}
                                                vectors ({info.dimensions} Dim)
                                            </span>
                                            <span>
                                                {formatBytes(info.memoryBytes)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteVectorSet(vectorSet)
                                        }}
                                        className=""
                                        title="Delete Vector Set"
                                    >
                                        <svg
                                            className="w-4 h-4 text-white"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                            />
                                        </svg>
                                    </Button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </SidebarContent>

            <CreateVectorSetModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onCreate={handleBasicCreateVectorSet}
            />

            <EditEmbeddingConfigModal
                isOpen={isEditConfigModalOpen}
                onClose={() => {
                    setIsEditConfigModalOpen(false)
                    setEditingVectorSet(null)
                }}
                vectorSetName={editingVectorSet || ""}
                onSave={handleSaveConfig}
            />
        </Sidebar>
    )
}
