import { userSettings } from "@/lib/storage/userSettings"
import { PCA } from "ml-pca"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import * as THREE from "three"
import { UMAP } from "umap-js"
import {
    ForceEdge,
    ForceNode,
    LayoutAlgorithm,
    LayoutAlgorithmType,
} from "../types"

export function useLayoutManager(
    nodesRef: React.MutableRefObject<ForceNode[]>,
    edgesRef: React.MutableRefObject<ForceEdge[]>,
    scene: THREE.Scene | null,
    camera: THREE.OrthographicCamera | null,
    renderer: THREE.WebGLRenderer | null,
    fitCameraToNodes: () => void,
    canvasRef: React.RefObject<HTMLCanvasElement>
) {
    // Get stored layout or default to "pca"
    const [currentLayout, setCurrentLayout] =
        useState<LayoutAlgorithmType>("pca")
    const forceSimulationActive = useRef<boolean>(true)
    const [isProjectionRunning, setIsProjectionRunning] =
        useState<boolean>(false)

    // Load stored layout on mount
    useEffect(() => {
        async function loadStoredLayout() {
            const storedLayout =
                userSettings.get<LayoutAlgorithmType>("hnswVizLayout")
            if (storedLayout) {
                setCurrentLayout(storedLayout)
            }
        }
        loadStoredLayout()
    }, [])

    // Helper function to normalize and scale projection coordinates
    const normalizeAndScaleProjection = useCallback(
        (projection: number[][], scale: number = 10) => {
            if (projection.length === 0) return projection

            // Find min and max for x and y
            let minX = Infinity,
                maxX = -Infinity,
                minY = Infinity,
                maxY = -Infinity

            projection.forEach(([x, y]) => {
                minX = Math.min(minX, x)
                maxX = Math.max(maxX, x)
                minY = Math.min(minY, y)
                maxY = Math.max(maxY, y)
            })

            // Calculate ranges
            const rangeX = maxX - minX || 1 // Avoid division by zero
            const rangeY = maxY - minY || 1

            // Get canvas dimensions
            const canvasWidth =
                canvasRef.current?.parentElement?.clientWidth ||
                window.innerWidth
            const canvasHeight =
                canvasRef.current?.parentElement?.clientHeight ||
                window.innerHeight
            const windowAspectRatio = canvasWidth / canvasHeight

            // Calculate aspect ratio of the data
            const dataAspectRatio = rangeX / rangeY

            // Adjust scale based on number of nodes to prevent overcrowding
            const nodeCountFactor =
                Math.log(projection.length + 1) / Math.log(20)
            const baseScale = scale * (1 + nodeCountFactor * 0.2)

            // Calculate scale factors to fill the window while maintaining relative distances
            let scaleX, scaleY
            if (dataAspectRatio > windowAspectRatio) {
                // Data is wider than window, scale height to match width
                scaleX = baseScale
                scaleY = baseScale * (dataAspectRatio / windowAspectRatio)
            } else {
                // Data is taller than window, scale width to match height
                scaleX = baseScale * (windowAspectRatio / dataAspectRatio)
                scaleY = baseScale
            }

            // Normalize to [-1, 1] and then apply the appropriate scaling
            return projection.map(([x, y]) => [
                (((x - minX) / rangeX) * 2 - 1) * scaleX,
                (((y - minY) / rangeY) * 2 - 1) * scaleY,
            ])
        },
        [canvasRef]
    )

    // Force-directed layout
    const forceLayout: LayoutAlgorithm = {
        name: "Force-Directed",
        description: "Physics-based layout that simulates forces between nodes",
        apply: () => {
            forceSimulationActive.current = true
        },
        animate: true,
    }

    // UMAP layout
    const umapLayout: LayoutAlgorithm = {
        name: "UMAP",
        description:
            "Uniform Manifold Approximation and Projection - preserves both local and global structure of high-dimensional data. Good for visualizing clusters.",
        apply: async (nodes) => {
            forceSimulationActive.current = false

            if (nodes.length === 0) return
            if (isProjectionRunning) return

            // UMAP requires at least 2 nodes to work properly
            if (nodes.length < 2) {
                return
            }

            setIsProjectionRunning(true)

            try {
                // Prepare data for UMAP
                const nodeOrder: ForceNode[] = []
                const vectors: number[][] = []
                nodes.forEach((node) => {
                    const vector = node.vector
                    if (vector) {
                        vectors.push(vector)
                        nodeOrder.push(node)
                    }
                })

                if (vectors.length < 2) {
                    toast.error(
                        "Not enough valid vectors for UMAP projection (need at least 2)"
                    )
                    setIsProjectionRunning(false)
                    return
                }

                // Configure and run UMAP
                const umap = new UMAP({
                    nComponents: 2,
                    nEpochs: 200,
                    nNeighbors: Math.min(15, vectors.length - 1),
                    minDist: 0.1,
                })

                // Fit and transform the data
                const embedding = umap.fit(vectors)

                // Normalize and scale the projection
                const normalizedEmbedding =
                    normalizeAndScaleProjection(embedding)

                // Apply the projection to node positions
                nodeOrder.forEach((node, i) => {
                    if (i < normalizedEmbedding.length) {
                        const [x, y] = normalizedEmbedding[i]
                        node.mesh.position.set(x, y, node.mesh.position.z)
                    }
                })

                // Update edge geometries
                edgesRef.current.forEach((edge) => {
                    const points = [
                        edge.source.mesh.position.clone(),
                        edge.target.mesh.position.clone(),
                    ]
                    const geometry = new THREE.BufferGeometry().setFromPoints(
                        points
                    )
                    edge.line.geometry.dispose()
                    edge.line.geometry = geometry
                })

                // Ensure camera fits all nodes after projection
                setTimeout(() => {
                    fitCameraToNodes()
                }, 100)
            } catch (error) {
                console.error("Error in UMAP projection:", error)
                toast.error(
                    `Error in UMAP projection: ${error instanceof Error ? error.message : "Unknown error"
                    }`
                )
            } finally {
                setIsProjectionRunning(false)
            }
        },
        animate: false,
    }

    // PCA layout
    const pcaLayout: LayoutAlgorithm = {
        name: "PCA",
        description:
            "Principal Component Analysis - linear projection that preserves global variance. Fast but may not capture complex relationships between points.",
        apply: async (nodes) => {
            forceSimulationActive.current = false

            if (nodes.length === 0) return
            if (isProjectionRunning) return

            // PCA requires at least 2 nodes to work properly
            if (nodes.length < 2) {
                return
            }

            setIsProjectionRunning(true)

            try {
                // Prepare data for PCA
                const vectors: number[][] = []
                const nodeOrder: ForceNode[] = []

                nodes.forEach((node) => {
                    if (node.vector && node.vector.length > 0) {
                        vectors.push(node.vector)
                        nodeOrder.push(node)
                    } else {
                        console.error("vector is not available for node", node.mesh.userData)
                    }
                })
                if (vectors.length === 0) {
                    toast.error("No valid vectors for PCA projection")
                    setIsProjectionRunning(false)
                    return
                }

                // Run PCA
                console.log("vectors", vectors.length)
                console.log("vector length", vectors[0].length)
                const pca = new PCA(vectors)
                const embedding = pca.predict(vectors, { nComponents: 2 })

                // Convert to array of arrays format
                const pcaEmbedding: number[][] = []
                for (let i = 0; i < embedding.rows; i++) {
                    pcaEmbedding.push([
                        embedding.getRow(i)[0],
                        embedding.getRow(i)[1],
                    ])
                }

                // Normalize and scale the projection
                const normalizedEmbedding =
                    normalizeAndScaleProjection(pcaEmbedding)

                // Apply the projection to node positions
                nodeOrder.forEach((node, i) => {
                    if (i < normalizedEmbedding.length) {
                        const [x, y] = normalizedEmbedding[i]
                        node.mesh.position.set(x, y, node.mesh.position.z)
                    }
                })

                // Update edge geometries
                edgesRef.current.forEach((edge) => {
                    const points = [
                        edge.source.mesh.position.clone(),
                        edge.target.mesh.position.clone(),
                    ]
                    const geometry = new THREE.BufferGeometry().setFromPoints(
                        points
                    )
                    edge.line.geometry.dispose()
                    edge.line.geometry = geometry
                })

                // Ensure camera fits all nodes after projection
                setTimeout(() => {
                    fitCameraToNodes()
                }, 100)
            } catch (error) {
                console.error("Error in PCA projection:", error)
                toast.error("Error in PCA projection")
            } finally {
                setIsProjectionRunning(false)
            }
        },
        animate: false,
    }

    // Map of available layouts
    const layouts: Record<LayoutAlgorithmType, LayoutAlgorithm> = {
        force: forceLayout,
        umap: umapLayout,
        pca: pcaLayout,
    }

    // Apply the current layout
    const applyLayout = useCallback(
        (layoutType: LayoutAlgorithmType, rootNode?: ForceNode) => {
            // Prevent rapid switching between layouts
            const now = Date.now()
            const lastLayoutChange = (window as any).lastLayoutChange || 0

            if (now - lastLayoutChange < 500) {
                // Ignore rapid layout changes (debounce)
                return
            }

            ; (window as any).lastLayoutChange = now

            // Only update layout type if it's different
            if (currentLayout !== layoutType) {
                setCurrentLayout(layoutType)
                // Store the layout preference
                userSettings.set("hnswVizLayout", layoutType)
            }

            // If switching to a projection method, show a toast with instructions
            if (["umap", "pca"].includes(layoutType)) {
                // Clear any previous attempt flags for this layout if we're explicitly selecting it
                const layoutKey = `${layoutType}_${nodesRef.current.length}`
                const attemptedKey = `attempted_${layoutKey}`
                    ; (window as any)[attemptedKey] = false
            }

            // Get the selected layout algorithm
            const layout = layouts[layoutType]

            // Apply the layout
            layout.apply(nodesRef.current, edgesRef.current, rootNode)

            // Fit camera to nodes after layout is applied
            setTimeout(() => fitCameraToNodes(), 100)
        },
        [currentLayout, layouts, nodesRef, edgesRef, fitCameraToNodes]
    )

    // Run projection layouts once when selected
    useEffect(() => {
        // Only run projection layouts once when they're selected and not already running
        if (["umap", "pca"].includes(currentLayout) && !isProjectionRunning) {
            const layout = layouts[currentLayout]

            // Use a flag to track if we've already attempted this layout
            const layoutKey = `${currentLayout}_${nodesRef.current.length}`
            const attemptedKey = `attempted_${layoutKey}`

            // Check if we've already attempted this exact layout with this number of nodes
            if (!(window as any)[attemptedKey]) {
                // Mark as attempted to prevent repeated calls
                ; (window as any)[attemptedKey] = true

                // Apply the layout with error handling
                try {
                    layout.apply(nodesRef.current, edgesRef.current)
                } catch (err) {
                    console.error(`Error in ${currentLayout} layout:`, err)
                    setIsProjectionRunning(false)
                }
            }
        }
    }, [currentLayout, layouts, nodesRef, edgesRef, isProjectionRunning])

    return {
        currentLayout,
        layouts,
        applyLayout,
        forceSimulationActive,
        isProjectionRunning,
    }
}
