import { useState, useEffect, useRef, useCallback } from "react"
import { VectorSetMetadata } from "@/app/types/embedding"
import EditEmbeddingConfigModal from "./EditEmbeddingConfigModal"
import CreateVectorSetModal from "./CreateVectorSetModal"
import { vectorSets } from "@/app/api/vector-sets"
import { redisCommands } from "@/app/api/redis-commands"
import { jobs, type Job } from "@/app/api/jobs"
import { ApiError } from "@/app/api/client"

import {
    estimateVectorSetMemoryUsage,
    formatBytes,
} from "@/app/utils/vectorSetMemory"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarHeader, SidebarContent } from "@/components/ui/sidebar"

interface VectorSetNavProps {
    redisUrl: string | null
    redisName?: string | null
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

export default function VectorSetNav({
    redisUrl,
    redisName,
    selectedVectorSet,
    onVectorSetSelect,
    onBack,
    isConnected
}: VectorSetNavProps) {
    const [vectorSetList, setVectorSetList] = useState<string[]>([])
    const [vectorSetInfo, setVectorSetInfo] = useState<Record<string, VectorSetInfo>>({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [editingVectorSet, setEditingVectorSet] = useState<string | null>(null)
    const [isInitialLoad, setIsInitialLoad] = useState(true)

    const loadVectorSets = useCallback(async () => {
        if (!isConnected) {
            console.error("Not connected, can't load vector sets")
            return
        }

        setLoading(true)
        setError(null)
        try {
            const sets = await vectorSets.list();
            setVectorSetList(sets as unknown as Array<string>);

            // Fetch info for each vector set
            const info: Record<string, VectorSetInfo> = {}
            
            const fetchVectorSetInfo = async (set: string, retryCount = 0): Promise<void> => {
                try {
                    // First get the basic vector set info
                    const [dimensions, vectorCount] = await Promise.all([
                        redisCommands.vdim(set),
                        redisCommands.vcard(set),
                    ]);

                    // Calculate estimated memory usage
                    const memoryBytes = estimateVectorSetMemoryUsage(
                        dimensions,
                        vectorCount
                    );

                    // Then try to get the jobs info, but don't let it block if it fails
                    let activeJobs = 0;
                    try {
                        const jobsList = await jobs.getJobsByVectorSet(set);
                        activeJobs = jobsList.filter((job) => 
                            job.status.status === 'processing' || 
                            job.status.status === 'paused' || 
                            job.status.status === 'pending'
                        ).length;
                    } catch (jobError) {
                        console.warn(`Warning: Could not fetch jobs for vector set ${set}:`, jobError);
                        // Continue with activeJobs as 0
                    }

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
            await Promise.all(sets.map(set => fetchVectorSetInfo(set)));

            setVectorSetInfo(info)
        } catch (error) {
            console.error("Error fetching vector sets:", error)
            setError(error instanceof ApiError ? error.message : "Failed to fetch vector sets")
            setVectorSetList([])
            setVectorSetInfo({})
        } finally {
            setLoading(false)
        }
    }, [isConnected])

    useEffect(() => {
        if (isConnected && redisUrl) {
            // Add a small delay to ensure cookie is set
            const timer = setTimeout(() => {
                loadVectorSets()
                setIsInitialLoad(true)
            }, 500)
            
            return () => clearTimeout(timer)
        } else {
            setVectorSetList([])
            setVectorSetInfo({})
            setIsInitialLoad(true)
        }
    }, [redisUrl, isConnected, loadVectorSets])

    useEffect(() => {
        if (isInitialLoad && vectorSetList.length > 0 && !selectedVectorSet) {
            onVectorSetSelect(vectorSetList[0])
            setIsInitialLoad(false)
        }
    }, [vectorSetList, selectedVectorSet, onVectorSetSelect, isInitialLoad])

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
        try {
            await vectorSets.create(name, {
                dimensions,
                metadata,
                customData
            });
            setStatusMessage(`Created vector set ${name}`)
            await loadVectorSets()
        } catch (error) {
            console.error("Error creating vector set:", error)
            setError(error instanceof ApiError ? error.message : "Failed to create vector set")
        }
    }

    const handleDeleteVectorSet = async (name: string) => {
        try {
            await vectorSets.delete(name);
            setStatusMessage(`Deleted vector set ${name}`)
            if (selectedVectorSet === name) {
                onVectorSetSelect(null)
            }
            await loadVectorSets()
        } catch (error) {
            console.error("Error deleting vector set:", error)
            setError(error instanceof ApiError ? error.message : "Failed to delete vector set")
        }
    }

    const handleSaveMetadata = async (
        name: string,
        metadata: VectorSetMetadata
    ) => {
        try {
            await vectorSets.create(name, {
                dimensions: vectorSetInfo[name]?.dimensions || 0,
                metadata
            });
            setStatusMessage(`Updated metadata for ${name}`)
            await loadVectorSets()
        } catch (error) {
            console.error("Error updating metadata:", error)
            setError(error instanceof ApiError ? error.message : "Failed to update metadata")
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
                        <span className="text-lg">{redisName}</span><span className="text-sm text-gray-500">({redisUrl})</span>
                    </Button>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <div className="list-container flex flex-col h-full space-y-0">
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
                    {error && (
                        <div className="text-sm text-red-500 mb-4 p-2 bg-red-50 rounded border border-red-200">
                            {error}
                        </div>
                    )}
                    {!loading && !error && vectorSetList.length === 0 && (
                        <div className="text-sm text-gray-500">
                            No vector sets found
                        </div>
                    )}
                    {vectorSetList.map((setName, index) => {
                        const info = vectorSetInfo[setName]
                        return (
                            <div
                                key={setName}
                                className={`group list-item relative ${
                                    selectedVectorSet === setName
                                        ? "list-item-selected"
                                        : index % 2 === 0
                                        ? "list-item-alt"
                                        : "list-item-default"
                                }`}
                            >
                                <div
                                    onClick={() => onVectorSetSelect(setName)}
                                    className="list-item-content truncate"
                                >
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="truncate overflow-hidden whitespace-nowrap min-w-0"
                                            title={setName}
                                        >
                                            {setName}
                                        </span>
                                        {info?.activeJobs > 0 && (
                                            <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded">
                                                {info.activeJobs}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex w-full justify-between text-xs">
                                        <span>
                                            {info &&
                                                info.vectorCount.toLocaleString()}{" "}
                                            vectors ({info && info.dimensions}{" "}
                                            Dim)
                                        </span>
                                        <span>
                                            {formatBytes(
                                                info ? info.memoryBytes : 0
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100">
                                    <Button
                                        variant="destructive"
                                        size="icon"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            handleDeleteVectorSet(setName)
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
                    <div className="grow"></div>
                    {loading && (
                        <div className="text-sm text-gray-500">Loading...</div>
                    )}
                    {statusMessage && (
                        <div className="text-sm text-green-600 mb-4 p-2 bg-green-50 rounded border border-green-200">
                            {statusMessage}
                        </div>
                    )}
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
                onSave={(config) => handleSaveMetadata(editingVectorSet || "", config)}
            />
        </Sidebar>
    )
}
