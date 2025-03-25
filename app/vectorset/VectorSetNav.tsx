import { ApiError } from "@/app/api/client"
import { jobs } from "@/app/api/jobs"
import { vectorSets } from "@/app/api/vector-sets"
import { vcard, vdim } from "@/app/redis-server/api"
import { VectorSetMetadata } from "@/app/types/vectorSetMetaData"
import { AppEvents } from "@/app/utils/eventEmitter"
import {
    estimateVectorSetMemoryUsage,
    formatBytes,
} from "@/app/utils/vectorSetMemory"
import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import { closeSocket, subscribe } from "@/lib/websocket"
import { debounce } from "lodash"
import { useCallback, useEffect, useRef, useState } from "react"
import EditEmbeddingConfigModal from "../components/EmbeddingConfig/EditEmbeddingConfigDialog"
import CreateVectorSetModal from "./CreateVectorSetDialog"
import DeleteVectorSetDialog from "./DeleteVectorSetDialog"
import { toast } from "sonner"

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
    metadata?: VectorSetMetadata
}

export default function VectorSetNav({
    redisUrl,
    redisName,
    selectedVectorSet,
    onVectorSetSelect,
    onBack,
    isConnected,
}: VectorSetNavProps) {
    const [vectorSetList, setVectorSetList] = useState<string[]>([])
    const [vectorSetInfo, setVectorSetInfo] = useState<
        Record<string, VectorSetInfo>
    >({})
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isEditConfigModalOpen, setIsEditConfigModalOpen] = useState(false)
    const [editingVectorSet, setEditingVectorSet] = useState<string | null>(
        null
    )
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [vectorSetToDelete, setVectorSetToDelete] = useState<string | null>(
        null
    )
    const [isInitialLoad, setIsInitialLoad] = useState(true)

    const refreshingRef = useRef(false)

    const loadVectorSets = useCallback(async () => {
        if (!isConnected) {
            console.error("Not connected, can't load vector sets")
            return
        }

        if (loading) {
            console.log("Already loading vector sets, skipping request")
            return
        }

        setLoading(true)
        setError(null)
        try {
            const sets = await vectorSets.list()

            let vectorSetsArray: string[] = []

            if (sets && Array.isArray(sets)) {
                vectorSetsArray = sets
            } else if (sets && sets.result && Array.isArray(sets.result)) {
                vectorSetsArray = sets.result
            } else {
                console.error(
                    "Invalid response structure from vector sets API:",
                    sets
                )
                setVectorSetList([])
                throw new Error("Invalid API response structure")
            }

            setVectorSetList(vectorSetsArray)

            const info: Record<string, VectorSetInfo> = {}

            const fetchVectorSetInfo = async (
                set: string,
                retryCount = 0
            ): Promise<void> => {
                try {
                    const [dimensions, vectorCount] = await Promise.all([
                        vdim({ keyName: set }).catch((err) => {
                            console.error(
                                `Error fetching dimensions for ${set}:`,
                                err
                            )
                            return 0
                        }),
                        vcard({ keyName: set }).catch((err) => {
                            console.error(
                                `Error fetching vector count for ${set}:`,
                                err
                            )
                            return 0
                        }),
                    ])

                    const memoryBytes = estimateVectorSetMemoryUsage(
                        dimensions,
                        vectorCount
                    )

                    let activeJobs = 0
                    try {
                        const jobsPromise = jobs.getJobsByVectorSet(set)
                        const timeoutPromise = new Promise((_, reject) =>
                            setTimeout(
                                () => reject(new Error("Jobs API timeout")),
                                3000
                            )
                        )

                        const jobsList = await Promise.race([
                            jobsPromise,
                            timeoutPromise,
                        ]).catch((error) => {
                            console.warn(
                                `Could not fetch jobs for ${set}:`,
                                error
                            )
                            return []
                        })

                        if (Array.isArray(jobsList)) {
                            activeJobs = jobsList.filter(
                                (job) =>
                                    job.status?.status === "processing" ||
                                    job.status?.status === "paused" ||
                                    job.status?.status === "pending"
                            ).length
                        }
                    } catch (jobError) {
                        console.warn(
                            `Warning: Could not fetch jobs for vector set ${set}:`,
                            jobError
                        )
                    }

                    info[set] = {
                        name: set,
                        memoryBytes,
                        dimensions,
                        vectorCount,
                        activeJobs,
                    }
                } catch (error) {
                    console.error(
                        `Error fetching info for vector set ${set}:`,
                        error
                    )
                    if (retryCount < 2) {
                        await new Promise((resolve) =>
                            setTimeout(resolve, 1000)
                        )
                        return fetchVectorSetInfo(set, retryCount + 1)
                    }
                    info[set] = {
                        name: set,
                        memoryBytes: 0,
                        dimensions: 0,
                        vectorCount: 0,
                        activeJobs: 0,
                    }
                }
            }

            await Promise.all(
                vectorSetsArray.map((set) => fetchVectorSetInfo(set))
            )

            setVectorSetInfo(info)
        } catch (error) {
            console.error("Error fetching vector sets:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Failed to fetch vector sets"
            )
            setVectorSetList([])
            setVectorSetInfo({})
        } finally {
            setLoading(false)
        }
    }, [isConnected, loading])

    useEffect(() => {
        const debouncedRefresh = debounce(() => {
            if (!refreshingRef.current) {
                refreshingRef.current = true
                loadVectorSets().finally(() => {
                    setTimeout(() => {
                        refreshingRef.current = false
                    }, 5000)
                })
            }
        }, 1000)

        const handleVectorAdded = async (data: {
            vectorSetName: string
            element: string
            newCount: number
        }) => {
            console.log(`Vector added to ${data.vectorSetName}`, data)

            if (vectorSetInfo[data.vectorSetName]) {
                setVectorSetInfo((prev) => ({
                    ...prev,
                    [data.vectorSetName]: {
                        ...prev[data.vectorSetName],
                        vectorCount: data.newCount,
                    },
                }))
            }
        }

        const handleVectorDeleted = async (data: {
            vectorSetName: string
            element?: string
            elements?: string[]
            newCount: number
        }) => {
            console.log(`Vector(s) deleted from ${data.vectorSetName}`, data)

            if (vectorSetInfo[data.vectorSetName]) {
                setVectorSetInfo((prev) => ({
                    ...prev,
                    [data.vectorSetName]: {
                        ...prev[data.vectorSetName],
                        vectorCount: data.newCount,
                    },
                }))
            }
        }

        const handleVectorsImported = (data: {
            vectorSetName: string
            jobId: string
        }) => {
            console.log(`Vectors imported to ${data.vectorSetName}`, data)
            debouncedRefresh()
        }

        const handleJobStatusChange = async (data: {
            vectorSetName: string
            status: string
            jobId: string
        }) => {
            console.log(`Job status changed for ${data.vectorSetName}:`, data)

            if (
                data.status === "completed" ||
                data.status === "failed" ||
                data.status === "aborted"
            ) {
                debouncedRefresh()
            } else if (
                data.status === "processing" ||
                data.status === "paused" ||
                data.status === "pending"
            ) {
                if (vectorSetInfo[data.vectorSetName]) {
                    setVectorSetInfo((prev) => ({
                        ...prev,
                        [data.vectorSetName]: {
                            ...prev[data.vectorSetName],
                            activeJobs:
                                (prev[data.vectorSetName]?.activeJobs || 0) + 1,
                        },
                    }))
                }
            }
        }

        let unsubscribes: Array<() => void> = []

        if (isConnected) {
            unsubscribes = [
                subscribe(AppEvents.VECTOR_ADDED, handleVectorAdded),
                subscribe(AppEvents.VECTOR_DELETED, handleVectorDeleted),
                subscribe(AppEvents.VECTORS_IMPORTED, handleVectorsImported),
                subscribe(AppEvents.JOB_STATUS_CHANGED, handleJobStatusChange),
            ]

            if (!refreshingRef.current) {
                debouncedRefresh()
            }
        }

        return () => {
            unsubscribes.forEach((unsubscribe) => unsubscribe())
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected, vectorSetInfo])

    useEffect(() => {
        return () => {
            closeSocket()
        }
    }, [])

    useEffect(() => {
        console.log("redisUrl", redisUrl)
        if (isConnected && redisUrl) {
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [redisUrl, isConnected])

    useEffect(() => {
        if (isInitialLoad && vectorSetList.length > 0 && !selectedVectorSet) {
            onVectorSetSelect(vectorSetList[0])
            setIsInitialLoad(false)
        }
    }, [vectorSetList, selectedVectorSet, onVectorSetSelect, isInitialLoad])

    useEffect(() => {
        if (statusMessage) {
            const timer = setTimeout(() => {
                setStatusMessage(null)
            }, 5000)

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
            await vectorSets.create({
                name,
                dimensions,
                metadata,
                customData,
            })
            setStatusMessage(`Created vector set ${name}`)
            await loadVectorSets()
            onVectorSetSelect(name)
        } catch (error) {
            console.error("Error creating vector set:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Failed to create vector set"
            )
        }
    }

    const handleDeleteVectorSet = async (name: string) => {
        try {
            await vectorSets.delete(name)
            setStatusMessage(`Deleted vector set ${name}`)
            if (selectedVectorSet === name) {
                onVectorSetSelect(null)
            }
            await loadVectorSets()
        } catch (error) {
            console.error("Error deleting vector set:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Failed to delete vector set"
            )
        }
    }

    const handleSaveMetadata = async (
        name: string,
        metadata: VectorSetMetadata
    ) => {
        try {
            await vectorSets.create({
                name,
                dimensions: vectorSetInfo[name]?.dimensions || 0,
                metadata,
            })
            setStatusMessage(`Updated metadata for ${name}`)
            await loadVectorSets()
        } catch (error) {
            console.error("Error updating metadata:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Failed to update metadata"
            )
        }
    }

    const openDeleteDialog = (name: string) => {
        setVectorSetToDelete(name)
        setIsDeleteDialogOpen(true)
    }

    const handleConfirmDelete = () => {
        if (vectorSetToDelete) {
            handleDeleteVectorSet(vectorSetToDelete)
            toast.success(`Vector set ${vectorSetToDelete} deleted`)
        }
    }

    return (
        <Sidebar
            defaultWidth={300}
            minWidth={200}
            maxWidth={500}
            className="sidebar-with-visible-handle"
        >
            <SidebarHeader>
                <div className="flex items-center -ml-4 truncate">
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
                        <span className="text-lg">{redisName}</span>
                        <span className="text-sm text-gray-500">
                            ({redisUrl})
                        </span>
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
                                onClick={() => loadVectorSets()}
                                title="Refresh Vector Sets"
                                className="p-1"
                            >
                                <svg
                                    className="w-5 h-5 text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={() => setIsCreateModalOpen(true)}
                                title="Quick Create Vector Set"
                                className="p-1"
                            >
                                <svg
                                    className="w-5 h-5 text-gray-500"
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
                                                Importing...
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
                                            openDeleteDialog(setName)
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

            {isCreateModalOpen && (
                <CreateVectorSetModal
                    isOpen={isCreateModalOpen}
                    onClose={() => setIsCreateModalOpen(false)}
                    onCreate={handleBasicCreateVectorSet}
                />
            )}

            {isEditConfigModalOpen && editingVectorSet && (
                <EditEmbeddingConfigModal
                    isOpen={isEditConfigModalOpen}
                    onClose={() => {
                        setIsEditConfigModalOpen(false)
                        setEditingVectorSet(null)
                    }}
                    config={
                        vectorSetInfo[editingVectorSet]?.metadata?.embedding
                    }
                    onSave={(config) =>
                        handleSaveMetadata(editingVectorSet, {
                            ...vectorSetInfo[editingVectorSet]?.metadata,
                            embedding: config,
                        })
                    }
                />
            )}

            {isDeleteDialogOpen && vectorSetToDelete && (
                <DeleteVectorSetDialog
                    isOpen={isDeleteDialogOpen}
                    onClose={() => setIsDeleteDialogOpen(false)}
                    onConfirm={handleConfirmDelete}
                    vectorSetName={vectorSetToDelete}
                />
            )}
        </Sidebar>
    )
}
