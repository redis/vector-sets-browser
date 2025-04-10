import { ApiError } from "@/app/api/client"
import { EmbeddingConfig } from "@/app/embeddings/types/embeddingModels"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { AlertTriangle, Info, Loader2, PowerOff } from "lucide-react"
import { useEffect, useState } from "react"
import { DEFAULT_VECTOR_DIMENSIONS } from "../vectorset/constants"

interface CacheInfo {
    size: number
}

interface CacheConfig {
    maxSize: number
    defaultTTL: number
    useCache: boolean
    embeddingConfig?: EmbeddingConfig
}

export default function CacheManager() {
    const [cacheInfo, setCacheInfo] = useState<CacheInfo | null>(null)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [clearing, setClearing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [noConnection, setNoConnection] = useState(false)
    const [config, setConfig] = useState<CacheConfig>({
        maxSize: 1000,
        defaultTTL: 86400,
        useCache: true,
        embeddingConfig: {
            provider: "none",
            none: {
                model: "default",
                dimensions: DEFAULT_VECTOR_DIMENSIONS,
            },
        },
    })

    const loadCacheInfo = async () => {
        try {
            setLoading(true)
            setError(null)
            setNoConnection(false)

            // Get cache info (size)
            const cacheResponse = await fetch("/api/embeddings/cache/config")
            if (cacheResponse.status === 401) {
                setNoConnection(true)
                return
            }

            if (!cacheResponse.ok) {
                throw new Error("Failed to load cache info")
            }

            const cacheData = await cacheResponse.json()
            if (!cacheData.success) {
                throw new Error(cacheData.error || "Unknown error")
            }

            // Get cache configuration
            const configResponse = await fetch("/api/embeddings/cache/config")
            if (configResponse.status === 401) {
                setNoConnection(true)
                return
            }

            if (!configResponse.ok) {
                throw new Error("Failed to load cache configuration")
            }

            const configData = await configResponse.json()
            if (!configData.success) {
                throw new Error(configData.error || "Unknown error")
            }

            // Update the cache info and configuration state
            setCacheInfo(cacheData)
            setConfig({
                maxSize: configData.maxSize || 1000,
                defaultTTL: configData.defaultTTL || 86400,
                useCache: configData.useCache !== undefined ? configData.useCache : true,
                embeddingConfig: configData.embeddingConfig || {
                    provider: "none",
                    none: {
                        model: "default",
                        dimensions: DEFAULT_VECTOR_DIMENSIONS,
                    },
                },
            })
        } catch (error) {
            console.error("Error loading cache info:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Error loading cache info"
            )
            setNoConnection(true)
        } finally {
            setLoading(false)
        }
    }

    const handleSaveConfig = async () => {
        setSaving(true)
        setError(null)
        setSuccess(null)
        try {
            const response = await fetch("/api/embeddings/cache/config", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    action: "setConfig",
                    params: {
                        ...config,
                        embeddingConfig: config.embeddingConfig,
                    },
                }),
            })

            if (response.status === 401) {
                setNoConnection(true)
                return
            }

            if (!response.ok) {
                throw new Error("Failed to save cache configuration")
            }

            const data = await response.json()
            if (data.success) {
                setSuccess("Cache configuration saved successfully")
                // Refresh cache info
                await loadCacheInfo()
            } else {
                throw new Error(data.error || "Unknown error")
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setSaving(false)
        }
    }

    const handleClearCache = async () => {
        try {
            setClearing(true)
            setError(null)
            const response = await fetch("/api/embeddings/cache", {
                method: "DELETE",
            })

            if (!response.ok) {
                throw new Error("Failed to clear cache")
            }

            const data = await response.json()
            if (data.success) {
                setSuccess("Cache cleared successfully")
                await loadCacheInfo()
            } else {
                throw new Error(data.error || "Unknown error")
            }
        } catch (error) {
            console.error("Error clearing cache:", error)
            setError(
                error instanceof ApiError
                    ? error.message
                    : "Error clearing cache"
            )
        } finally {
            setClearing(false)
        }
    }

    useEffect(() => {
        loadCacheInfo()
    }, [])

    if (noConnection) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle>Embedding Cache Management</CardTitle>
                    <CardDescription>
                        Configure and manage the embedding cache settings
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                        <h3 className="text-lg font-semibold mb-2">
                            No Redis Connection
                        </h3>
                        <p className="text-gray-500 mb-4">
                            Please connect to a Redis database to manage the
                            embedding cache.
                        </p>
                        <Button
                            onClick={() => (window.location.href = "/config")}
                        >
                            Refresh
                        </Button>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>Embedding Cache Management</CardTitle>
                        <CardDescription>
                            Configure and manage the embedding cache settings
                        </CardDescription>
                    </div>
                    <div className="flex items-center space-x-2">
                        <Label htmlFor="useCache" className="sr-only">
                            Enable Cache
                        </Label>
                        <Switch
                            id="useCache"
                            checked={config.useCache}
                            onCheckedChange={(checked) =>
                                setConfig({ ...config, useCache: checked })
                            }
                        />
                        <span className="text-sm font-medium">
                            {config.useCache ? "Enabled" : "Disabled"}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="flex justify-center items-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
                    </div>
                ) : (
                    <div className="relative">
                        {/* Grey overlay when cache is disabled */}
                        {!config.useCache && (
                            <div className="absolute inset-0 bg-gray-200 bg-opacity-70 dark:bg-gray-800 dark:bg-opacity-70 z-10 flex flex-col items-center justify-center rounded-md">
                                <PowerOff className="h-12 w-12 text-gray-500 mb-3" />
                                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                    Cache is disabled
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-md text-center">
                                    All embedding requests will go directly to
                                    the provider without caching. Enable the
                                    cache using the toggle above.
                                </p>
                            </div>
                        )}

                        <div className="space-y-6">
                            <div className="bg-blue-50 p-4 rounded-md border border-blue-100 mb-4 dark:bg-blue-900/20 dark:border-blue-800">
                                <div className="flex items-start">
                                    <Info className="h-5 w-5 text-blue-500 mr-2 mt-0.5 dark:text-blue-400" />
                                    <div>
                                        <h4 className="text-sm font-medium text-blue-800 mb-1 dark:text-blue-300">
                                            Embedding Cache
                                        </h4>
                                        <p className="text-xs text-blue-700 dark:text-blue-400">
                                            Embeddings will be cached in your
                                            Redis Database. Coming soon:
                                            external cache database.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="text-sm font-medium">
                                    Current Cache Size:
                                </div>
                                <div className="text-sm">
                                    {cacheInfo?.size} entries
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="maxSize">
                                        Maximum Cache Size
                                    </Label>
                                    <Input
                                        id="maxSize"
                                        type="number"
                                        value={config.maxSize}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                maxSize: parseInt(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                    />
                                    <p className="text-xs text-gray-500">
                                        Maximum number of embedding entries to
                                        keep in cache. When this limit is
                                        reached, the least recently used entries
                                        will be removed.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="defaultTTL">
                                        Default TTL (seconds)
                                    </Label>
                                    <Input
                                        id="defaultTTL"
                                        type="number"
                                        value={config.defaultTTL}
                                        onChange={(e) =>
                                            setConfig({
                                                ...config,
                                                defaultTTL: parseInt(
                                                    e.target.value
                                                ),
                                            })
                                        }
                                    />
                                    <p className="text-xs text-gray-500">
                                        Default time-to-live for cached
                                        embeddings in seconds (86400 = 24
                                        hours). This is used for metadata
                                        tracking but actual expiration is
                                        handled by the LRU mechanism.
                                    </p>
                                </div>
                            </div>

                            {error && (
                                <Alert variant="destructive">
                                    <AlertDescription>{error}</AlertDescription>
                                </Alert>
                            )}

                            {success && (
                                <Alert>
                                    <AlertDescription>
                                        {success}
                                    </AlertDescription>
                                </Alert>
                            )}

                            <div className="flex justify-between">
                                <Button
                                    variant="destructive"
                                    onClick={handleClearCache}
                                    disabled={clearing || saving}
                                >
                                    {clearing ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Clearing...
                                        </>
                                    ) : (
                                        "Clear Cache"
                                    )}
                                </Button>

                                <Button
                                    onClick={handleSaveConfig}
                                    disabled={clearing || saving}
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        "Save Configuration"
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
