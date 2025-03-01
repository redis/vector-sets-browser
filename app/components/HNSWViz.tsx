import React, { useRef, useState, useEffect, useCallback } from "react"
import * as THREE from "three"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { div } from "@tensorflow/tfjs"
// import { Button } from "@/components/ui/button"; // (Unused in this example)

//
// Type Definitions
//
interface HNSWVizProps {
    keyName: string
    initialElement: string
    maxNodes?: number
    initialNodes?: number
}

interface VLinkResponse {
    success: boolean
    result: Array<[string, number][]>
}

interface VembResponse {
    success: boolean
    result: number[]
}

interface ForceNode {
    mesh: THREE.Mesh
    velocity: THREE.Vector2
    force: THREE.Vector2
}

interface ForceEdge {
    source: ForceNode
    target: ForceNode
    line: THREE.Line
    strength: number
    isParentChild?: boolean
}

//
// Layout Algorithm Types
//
type LayoutAlgorithmType = "force" | "radial" | "grid"

interface LayoutAlgorithm {
    name: string
    description: string
    apply: (
        nodes: ForceNode[],
        edges: ForceEdge[],
        rootNode?: ForceNode
    ) => void
    animate: boolean
}

//
// Three.js Scene Manager Hook
//
function useThreeScene() {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [scene, setScene] = useState<THREE.Scene | null>(null)
    const [camera, setCamera] = useState<THREE.OrthographicCamera | null>(null)
    const [renderer, setRenderer] = useState<THREE.WebGLRenderer | null>(null)
    const frustumSizeRef = useRef<number>(20)
    const targetFrustumSizeRef = useRef<number>(20)
    const [zoomLevel, setZoomLevel] = useState<number>(1)
    const [isAutoZoom, setIsAutoZoom] = useState<boolean>(true)
    const lastUpdateTimeRef = useRef<number>(0)
    const cameraPositionRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 10))
    const isInitialZoomRef = useRef<boolean>(true)

    useEffect(() => {
        if (!canvasRef.current) return

        // Create scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0xffffff)

        // Set up camera (using orthographic projection)
        const parentWidth =
            canvasRef.current.parentElement?.clientWidth || window.innerWidth
        const parentHeight =
            canvasRef.current.parentElement?.clientHeight || window.innerHeight
        const aspect = parentWidth / parentHeight
        const frustumSize = 20
        frustumSizeRef.current = frustumSize
        targetFrustumSizeRef.current = frustumSize
        const camera = new THREE.OrthographicCamera(
            (-frustumSize * aspect) / 2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.1,
            1000
        )
        camera.position.set(0, 0, 10)
        cameraPositionRef.current = camera.position.clone()

        // Create renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            antialias: true,
        })
        renderer.setSize(parentWidth, parentHeight)

        // Handle container resizing
        const updateSize = () => {
            if (!canvasRef.current) return
            const parent = canvasRef.current.parentElement
            if (!parent) return
            const width = parent.clientWidth
            const height = parent.clientHeight
            renderer.setSize(width, height)
            const aspect = width / height
            camera.left = (-frustumSizeRef.current * aspect) / 2
            camera.right = (frustumSizeRef.current * aspect) / 2
            camera.top = frustumSizeRef.current / 2
            camera.bottom = -frustumSizeRef.current / 2
            camera.updateProjectionMatrix()
        }

        updateSize()
        const resizeObserver = new ResizeObserver(updateSize)
        if (canvasRef.current.parentElement) {
            resizeObserver.observe(canvasRef.current.parentElement)
        }

        setScene(scene)
        setCamera(camera)
        setRenderer(renderer)

        // Animation loop for smooth transitions
        const animateCamera = () => {
            if (
                Math.abs(
                    frustumSizeRef.current - targetFrustumSizeRef.current
                ) > 0.01
            ) {
                // Smooth interpolation (easing)
                frustumSizeRef.current +=
                    (targetFrustumSizeRef.current - frustumSizeRef.current) *
                    0.1

                if (canvasRef.current && canvasRef.current.parentElement) {
                    const width = canvasRef.current.parentElement.clientWidth
                    const height = canvasRef.current.parentElement.clientHeight
                    const aspect = width / height

                    camera.left = (-frustumSizeRef.current * aspect) / 2
                    camera.right = (frustumSizeRef.current * aspect) / 2
                    camera.top = frustumSizeRef.current / 2
                    camera.bottom = -frustumSizeRef.current / 2
                    camera.updateProjectionMatrix()
                }
            }

            // Smooth camera position transition
            if (camera.position.distanceTo(cameraPositionRef.current) > 0.01) {
                camera.position.lerp(cameraPositionRef.current, 0.1)
                camera.updateProjectionMatrix()
            }

            requestAnimationFrame(animateCamera)
        }

        animateCamera()

        return () => {
            resizeObserver.disconnect()
            renderer.dispose()
        }
    }, [])

    // Function to adjust camera zoom to fit all nodes
    const fitCameraToNodes = useCallback(() => {
        if (!scene || !camera) return
        if (!isAutoZoom && !isInitialZoomRef.current) return

        // Find all node meshes in the scene
        const nodes = scene.children.filter(
            (obj) => obj.userData && obj.userData.isNode
        )

        if (nodes.length === 0) return

        // Calculate bounding box
        const boundingBox = new THREE.Box3()
        nodes.forEach((node) => {
            boundingBox.expandByObject(node)
        })

        // Calculate the size needed to fit all nodes
        const size = boundingBox.getSize(new THREE.Vector3())
        const center = boundingBox.getCenter(new THREE.Vector3())

        // Get the maximum dimension to ensure all nodes fit
        const maxDim = Math.max(size.x, size.y)

        // Add padding (10% instead of 20% to maximize node size)
        const padding = 1.1

        // Calculate new frustum size
        // Use a minimum size to prevent excessive zoom when nodes are close together
        const minFrustumSize = nodes.length <= 1 ? 5 : 8
        let newFrustumSize = Math.max(maxDim * padding, minFrustumSize)

        // Apply manual zoom factor
        newFrustumSize = newFrustumSize / zoomLevel

        // Throttle updates to avoid too frequent changes
        const now = Date.now()
        if (now - lastUpdateTimeRef.current > 100) {
            lastUpdateTimeRef.current = now

            // Set target for smooth transition
            targetFrustumSizeRef.current = newFrustumSize

            // Set target camera position for smooth transition
            const newPosition = new THREE.Vector3(center.x, center.y, 10)
            cameraPositionRef.current = newPosition

            // After initial zoom, mark as no longer initial
            if (isInitialZoomRef.current) {
                isInitialZoomRef.current = false
            }
        }
    }, [scene, camera, zoomLevel, isAutoZoom])

    // Function to manually set zoom level
    const setManualZoom = useCallback(
        (level: number) => {
            setZoomLevel(level)

            // Apply zoom immediately
            if (camera) {
                // const currentSize = frustumSizeRef.current  // Unused but kept for reference
                const newSize = 20 / level
                targetFrustumSizeRef.current = newSize

                // If auto zoom is off, we need to manually update the target frustum size
                if (!isAutoZoom) {
                    // Keep the current center point when zooming
                    // const aspect = canvasRef.current?.parentElement?.clientWidth
                    //     ? canvasRef.current.parentElement.clientWidth /
                    //       canvasRef.current.parentElement.clientHeight
                    //     : 1

                    // const centerX = camera.position.x
                    // const centerY = camera.position.y

                    // No need to change camera position, just the frustum size
                    targetFrustumSizeRef.current = newSize
                }
            }
        },
        [camera, isAutoZoom]
    )

    // Toggle auto zoom
    const toggleAutoZoom = useCallback(() => {
        setIsAutoZoom((prev) => {
            const newValue = !prev

            // If turning auto zoom on, immediately fit to nodes
            if (newValue && scene && camera) {
                setTimeout(() => fitCameraToNodes(), 0)
            }

            return newValue
        })
    }, [scene, camera, fitCameraToNodes])

    // Reset view to fit all nodes
    const resetView = useCallback(() => {
        if (scene && camera) {
            setIsAutoZoom(true)
            setZoomLevel(1)
            isInitialZoomRef.current = true // Force a recalculation
            setTimeout(() => fitCameraToNodes(), 0)
        }
    }, [scene, camera, fitCameraToNodes])

    return {
        canvasRef,
        scene,
        camera,
        renderer,
        fitCameraToNodes,
        _zoomLevel: zoomLevel,
        _setManualZoom: setManualZoom,
        _isAutoZoom: isAutoZoom,
        _toggleAutoZoom: toggleAutoZoom,
        resetView,
    }
}

//
// Force Simulation Hook
//
function useForceSimulator(
    scene: THREE.Scene | null,
    fitCameraToNodes: () => void
) {
    // Simulation parameters
    const REPULSION = 1.0
    const SPRING_LENGTH = 3.0
    const SPRING_COEFFICIENT = 0.1
    const TIMESTEP = 0.1
    const ITERATIONS_PER_FRAME = 10

    const nodesRef = useRef<ForceNode[]>([])
    const edgesRef = useRef<ForceEdge[]>([])
    const animationFrameId = useRef<number>()

    const addNode = useCallback((mesh: THREE.Mesh) => {
        const node: ForceNode = {
            mesh,
            velocity: new THREE.Vector2(0, 0),
            force: new THREE.Vector2(0, 0),
        }
        nodesRef.current.push(node)
        return node
    }, [])

    const addEdge = useCallback(
        (
            source: ForceNode,
            target: ForceNode,
            strength: number,
            line: THREE.Line
        ) => {
            const edge: ForceEdge = { source, target, line, strength }
            edgesRef.current.push(edge)
            return edge
        },
        []
    )

    const simulateForces = useCallback(() => {
        // Run several iterations per frame
        for (let iter = 0; iter < ITERATIONS_PER_FRAME; iter++) {
            // Reset forces and apply damping
            nodesRef.current.forEach((node) => {
                node.force.set(0, 0)
                node.velocity.multiplyScalar(0.9)
            })

            // Calculate repulsive forces between nodes
            for (let i = 0; i < nodesRef.current.length; i++) {
                for (let j = i + 1; j < nodesRef.current.length; j++) {
                    const nodeA = nodesRef.current[i]
                    const nodeB = nodesRef.current[j]
                    const dx = nodeB.mesh.position.x - nodeA.mesh.position.x
                    const dy = nodeB.mesh.position.y - nodeA.mesh.position.y
                    const distSq = dx * dx + dy * dy || 0.001
                    const dist = Math.sqrt(distSq)
                    const force = REPULSION / distSq
                    const fx = (dx / dist) * force
                    const fy = (dy / dist) * force
                    nodeA.force.x -= fx
                    nodeA.force.y -= fy
                    nodeB.force.x += fx
                    nodeB.force.y += fy
                }
            }

            // Calculate spring forces along edges
            edgesRef.current.forEach((edge) => {
                const dx =
                    edge.target.mesh.position.x - edge.source.mesh.position.x
                const dy =
                    edge.target.mesh.position.y - edge.source.mesh.position.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
                const force =
                    (dist - SPRING_LENGTH) * SPRING_COEFFICIENT * edge.strength
                const fx = (dx / dist) * force
                const fy = (dy / dist) * force
                edge.source.force.x += fx
                edge.source.force.y += fy
                edge.target.force.x -= fx
                edge.target.force.y -= fy
            })

            // Update positions based on forces
            nodesRef.current.forEach((node) => {
                node.velocity.x += node.force.x * TIMESTEP
                node.velocity.y += node.force.y * TIMESTEP
                node.mesh.position.x += node.velocity.x * TIMESTEP
                node.mesh.position.y += node.velocity.y * TIMESTEP
            })

            // Optionally, update edge geometries here if needed.
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
        }

        // Adjust camera to fit all nodes after forces are applied
        fitCameraToNodes()
    }, [
        ITERATIONS_PER_FRAME,
        REPULSION,
        SPRING_LENGTH,
        SPRING_COEFFICIENT,
        TIMESTEP,
        fitCameraToNodes,
    ])

    const startSimulation = useCallback(
        (
            scene: THREE.Scene | null,
            camera: THREE.OrthographicCamera | null,
            renderer: THREE.WebGLRenderer | null,
            isForceActive: React.MutableRefObject<boolean>
        ) => {
            const animate = () => {
                // Only run force simulation if it's the active layout
                if (isForceActive.current) {
                    simulateForces()
                }

                if (scene && camera && renderer) {
                    renderer.render(scene, camera)
                }
                animationFrameId.current = requestAnimationFrame(animate)
            }
            animate()
        },
        [simulateForces]
    )

    useEffect(() => {
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
            }
        }
    }, [])

    return { nodesRef, edgesRef, addNode, addEdge, startSimulation }
}

//
// Layout Manager Hook
//
function useLayoutManager(
    nodesRef: React.MutableRefObject<ForceNode[]>,
    edgesRef: React.MutableRefObject<ForceEdge[]>,
    scene: THREE.Scene | null,
    camera: THREE.OrthographicCamera | null,
    renderer: THREE.WebGLRenderer | null,
    fitCameraToNodes: () => void
) {
    const [currentLayout, setCurrentLayout] =
        useState<LayoutAlgorithmType>("force")
    const animationFrameId = useRef<number>()
    const forceSimulationActive = useRef<boolean>(true)

    // Force-directed layout (already implemented in useForceSimulator)
    const forceLayout: LayoutAlgorithm = {
        name: "Force-Directed",
        description: "Physics-based layout that simulates forces between nodes",
        apply: () => {
            // This is handled by the useForceSimulator hook
            forceSimulationActive.current = true
        },
        animate: true,
    }

    // Radial layout - arranges nodes in concentric circles around a center node
    const radialLayout: LayoutAlgorithm = {
        name: "Radial",
        description:
            "Arranges nodes in concentric circles around the root node",
        apply: (nodes, edges, rootNode) => {
            forceSimulationActive.current = false

            if (nodes.length === 0) return

            // Find the root node if not provided
            const root = rootNode || nodes[0]
            const rootPos = root.mesh.position

            // Create a map of nodes to their level (distance from root)
            const nodeLevels = new Map<ForceNode, number>()
            nodeLevels.set(root, 0)

            // BFS to determine node levels
            const queue: ForceNode[] = [root]
            const visited = new Set<ForceNode>([root])

            while (queue.length > 0) {
                const current = queue.shift()!
                const level = nodeLevels.get(current)!

                // Find all connected nodes
                edges.forEach((edge) => {
                    let neighbor: ForceNode | null = null

                    if (edge.source === current && !visited.has(edge.target)) {
                        neighbor = edge.target
                    } else if (
                        edge.target === current &&
                        !visited.has(edge.source)
                    ) {
                        neighbor = edge.source
                    }

                    if (neighbor) {
                        visited.add(neighbor)
                        nodeLevels.set(neighbor, level + 1)
                        queue.push(neighbor)
                    }
                })
            }

            // Count nodes at each level
            const levelCounts = new Map<number, number>()
            const levelNodes = new Map<number, ForceNode[]>()

            nodeLevels.forEach((level, node) => {
                levelCounts.set(level, (levelCounts.get(level) || 0) + 1)
                if (!levelNodes.has(level)) {
                    levelNodes.set(level, [])
                }
                levelNodes.get(level)!.push(node)
            })

            // Position nodes in concentric circles
            // const maxLevel = Math.max(...Array.from(levelCounts.keys())); // Unused but kept for reference
            const radiusStep = 3 // Distance between levels

            nodeLevels.forEach((level, node) => {
                if (node === root) {
                    // Keep root at its position
                    return
                }

                const radius = level * radiusStep
                const nodesAtLevel = levelCounts.get(level) || 1
                const nodeIndex = levelNodes.get(level)!.indexOf(node)
                const angleStep = (2 * Math.PI) / nodesAtLevel
                const angle = nodeIndex * angleStep

                const x = rootPos.x + radius * Math.cos(angle)
                const y = rootPos.y + radius * Math.sin(angle)

                // Smoothly transition to new position
                const targetPosition = new THREE.Vector3(
                    x,
                    y,
                    node.mesh.position.z
                )
                node.mesh.position.lerp(targetPosition, 0.1)
            })

            // Update edge geometries
            edges.forEach((edge) => {
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
        },
        animate: true,
    }

    // Grid layout - arranges nodes in a grid pattern
    const gridLayout: LayoutAlgorithm = {
        name: "Grid",
        description: "Arranges nodes in a grid pattern",
        apply: (nodes) => {
            forceSimulationActive.current = false

            if (nodes.length === 0) return

            const gridSize = Math.ceil(Math.sqrt(nodes.length))
            const spacing = 3

            // Calculate grid center
            const centerX = ((gridSize - 1) * spacing) / 2
            const centerY = ((gridSize - 1) * spacing) / 2

            nodes.forEach((node, index) => {
                const row = Math.floor(index / gridSize)
                const col = index % gridSize

                const x = col * spacing - centerX
                const y = row * spacing - centerY

                // Smoothly transition to new position
                const targetPosition = new THREE.Vector3(
                    x,
                    y,
                    node.mesh.position.z
                )
                node.mesh.position.lerp(targetPosition, 0.1)
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
        },
        animate: true,
    }

    // Map of available layouts
    const layouts: Record<LayoutAlgorithmType, LayoutAlgorithm> = {
        force: forceLayout,
        radial: radialLayout,
        grid: gridLayout,
    }

    // Apply the current layout
    const applyLayout = useCallback(
        (layoutType: LayoutAlgorithmType, rootNode?: ForceNode) => {
            setCurrentLayout(layoutType)

            // Get the selected layout algorithm
            const layout = layouts[layoutType]

            // Apply the layout
            layout.apply(nodesRef.current, edgesRef.current, rootNode)

            // Fit camera to nodes after layout is applied
            setTimeout(() => fitCameraToNodes(), 100)
        },
        [layouts, nodesRef, edgesRef, fitCameraToNodes]
    )

    // Start animation loop for layouts that need continuous updates
    useEffect(() => {
        const layout = layouts[currentLayout]

        if (layout.animate) {
            const animate = () => {
                // Only apply non-force layouts here
                if (currentLayout !== "force") {
                    layout.apply(nodesRef.current, edgesRef.current)
                }

                if (scene && camera && renderer) {
                    renderer.render(scene, camera)
                }

                animationFrameId.current = requestAnimationFrame(animate)
            }

            animate()
        }

        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
            }
        }
    }, [currentLayout, layouts, nodesRef, edgesRef, scene, camera, renderer])

    return {
        currentLayout,
        layouts,
        applyLayout,
        forceSimulationActive,
    }
}

//
// Node Management Hook (Data fetching and expansion)
//
function useNodeManager(keyName: string, maxNodes: number) {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const getNeighbors = useCallback(
        async (element: string): Promise<VLinkResponse> => {
            try {
                if (!element) {
                    setErrorMessage("Element is undefined")
                    return { success: false, result: [] }
                }
                const params = {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ keyName, element, count: maxNodes }),
                }
                const response = await fetch(`/api/redis/command/vlink`, params)
                const data = await response.json()
                if (!data.success) {
                    setErrorMessage("VLINK request failed")
                    return { success: false, result: [] }
                }
                return data
            } catch (error) {
                console.error("Error fetching neighbors:", error)
                setErrorMessage("Error fetching neighbors")
                return { success: false, result: [] }
            }
        },
        [keyName, maxNodes]
    )

    const getVector = useCallback(
        async (element: string): Promise<VembResponse> => {
            try {
                if (!element) {
                    setErrorMessage("Element is undefined")
                    return { success: false, result: [] }
                }
                const params = {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ keyName, element }),
                }
                const response = await fetch(`/api/redis/command/vemb`, params)
                const data = await response.json()
                if (!data.success) {
                    setErrorMessage("VEMB request failed")
                    return { success: false, result: [] }
                }
                return data
            } catch (error) {
                console.error("Error fetching vector:", error)
                setErrorMessage("Error fetching vector")
                return { success: false, result: [] }
            }
        },
        [keyName]
    )

    return { errorMessage, getNeighbors, getVector }
}

//
// Canvas Events Hook (Mouse interaction)
//
function useCanvasEvents(
    canvasRef: React.RefObject<HTMLCanvasElement>,
    camera: THREE.OrthographicCamera | null,
    scene: THREE.Scene | null,
    onNodeClick: (mesh: THREE.Mesh) => void,
    onNodeHover: (mesh: THREE.Mesh | null) => void,
    updateHoverLabel: (mesh: THREE.Mesh | null, x: number, y: number) => void
) {
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    const hoveredNodeRef = useRef<THREE.Mesh | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !camera || !scene) return

        const onMouseMove = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            raycaster.setFromCamera(mouse, camera)

            // Handle hover effects
            const intersects = raycaster.intersectObjects(scene.children)
            const hovered = intersects.find((i) => i.object.userData.isNode)

            if (hovered) {
                if (hoveredNodeRef.current !== hovered.object) {
                    // New node hovered
                    hoveredNodeRef.current = hovered.object as THREE.Mesh
                    onNodeHover(hoveredNodeRef.current)
                    // Update hover label with mouse position
                    updateHoverLabel(
                        hoveredNodeRef.current,
                        event.clientX,
                        event.clientY
                    )
                } else {
                    // Same node, but update position
                    updateHoverLabel(
                        hoveredNodeRef.current,
                        event.clientX,
                        event.clientY
                    )
                }
            } else if (hoveredNodeRef.current) {
                // No longer hovering over any node
                hoveredNodeRef.current = null
                onNodeHover(null)
                updateHoverLabel(null, event.clientX, event.clientY)
            }
        }

        const onClick = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            raycaster.setFromCamera(mouse, camera)
            const intersects = raycaster.intersectObjects(scene.children)
            const clicked = intersects.find((i) => i.object.userData.isNode)
            if (clicked) {
                onNodeClick(clicked.object as THREE.Mesh)
            }
        }

        canvas.addEventListener("mousemove", onMouseMove)
        canvas.addEventListener("click", onClick)
        return () => {
            canvas.removeEventListener("mousemove", onMouseMove)
            canvas.removeEventListener("click", onClick)
        }
    }, [canvasRef, camera, scene, onNodeClick, onNodeHover, updateHoverLabel])
}

//
// Main Component: HNSWViz
//
const HNSWViz: React.FC<HNSWVizProps> = ({
    keyName,
    initialElement,
    maxNodes = 100,
    initialNodes = 20,
}) => {
    const {
        canvasRef,
        scene,
        camera,
        renderer,
        fitCameraToNodes,
        _zoomLevel: zoomLevel,
        _setManualZoom: setManualZoom,
        _isAutoZoom: isAutoZoom,
        _toggleAutoZoom: toggleAutoZoom,
        resetView,
    } = useThreeScene()
    const { errorMessage, getNeighbors, getVector } = useNodeManager(
        keyName,
        maxNodes
    )
    const { nodesRef, edgesRef, addNode, addEdge, startSimulation } =
        useForceSimulator(scene, fitCameraToNodes)
    const { currentLayout, layouts, applyLayout, forceSimulationActive } =
        useLayoutManager(
            nodesRef,
            edgesRef,
            scene,
            camera,
            renderer,
            fitCameraToNodes
        )
    const [selectedNode, setSelectedNode] = useState<THREE.Mesh | null>(null)
    const [_hoveredNode, setHoveredNode] = useState<THREE.Mesh | null>(null)
    const [renderedElements, setRenderedElements] = useState<Set<string>>(
        new Set()
    )

    // State for reset confirmation dialog
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)

    // References for hover and selection effects
    const hoverHighlightRef = useRef<THREE.Mesh | null>(null)
    const _hoverLabelRef = useRef<THREE.Sprite | null>(null) // Prefixed with _ to indicate it's intentionally unused
    const pulseAnimationRef = useRef<number>(0)
    const pulseDirectionRef = useRef<number>(1)
    const pulseScaleRef = useRef<number>(1)

    // State for HTML hover label
    const [hoverLabel, setHoverLabel] = useState<{
        visible: boolean
        text: string
        x: number
        y: number
    }>({
        visible: false,
        text: "",
        x: 0,
        y: 0,
    })

    // Create and add a node to the scene
    const createNode = useCallback(
        (
            element: string,
            x: number,
            y: number,
            parentNode?: THREE.Mesh
        ): THREE.Mesh | null => {
            if (renderedElements.has(element) || !scene) return null

            const geometry = new THREE.CircleGeometry(0.5, 32)
            const material = new THREE.MeshBasicMaterial({
                color: 0x4a90e2,
                transparent: true,
                opacity: 0.8,
            })
            const circle = new THREE.Mesh(geometry, material)
            circle.position.set(x, y, 0)
            circle.userData = {
                element,
                isNode: true,
                expanded: false, // Whether neighbors have been fetched
                displayState: "expanded", // Visual state: "expanded" or "collapsed"
                neighborCount: 0,
                similarity: null,
                parentNode: parentNode || null, // Track the parent node that created this node
                childNodes: [], // Track child nodes created from this node
            }
            scene.add(circle)
            addNode(circle)
            setRenderedElements((prev) => new Set(prev).add(element))

            // Add this node as a child to its parent
            if (parentNode) {
                if (!parentNode.userData.childNodes) {
                    parentNode.userData.childNodes = []
                }
                parentNode.userData.childNodes.push(circle)
            }

            // Only fit camera on initial nodes, not on every node addition
            // This prevents the disorienting zoom reset
            if (renderedElements.size < 5) {
                setTimeout(() => fitCameraToNodes(), 0)
            }

            return circle
        },
        [renderedElements, scene, addNode, fitCameraToNodes]
    )

    // Create and add an edge between nodes
    const createEdge = useCallback(
        (
            source: THREE.Mesh,
            target: THREE.Mesh,
            similarity: number,
            isParentChild: boolean = false
        ): THREE.Line | null => {
            if (!scene) return null
            const points = [source.position.clone(), target.position.clone()]
            const geometry = new THREE.BufferGeometry().setFromPoints(points)
            const material = new THREE.LineBasicMaterial({
                color: 0x4a90e2,
                transparent: true,
                opacity: Math.min(similarity, 0.8),
            })
            const line = new THREE.Line(geometry, material)
            scene.add(line)

            // Associate with force simulation
            const sourceNode = nodesRef.current.find((n) => n.mesh === source)
            const targetNode = nodesRef.current.find((n) => n.mesh === target)
            if (sourceNode && targetNode) {
                addEdge(sourceNode, targetNode, similarity, line)

                // Store the parent-child relationship in the edge
                const edge = edgesRef.current[edgesRef.current.length - 1]
                edge.isParentChild = isParentChild
            }
            return line
        },
        [scene, nodesRef, addEdge, edgesRef]
    )

    // Handle node hover
    const handleNodeHover = useCallback(
        (mesh: THREE.Mesh | null) => {
            setHoveredNode(mesh)

            // Remove previous hover effects
            if (hoverHighlightRef.current && scene) {
                scene.remove(hoverHighlightRef.current)
                hoverHighlightRef.current = null
            }

            // Add new hover effects if hovering over a node
            if (mesh && scene) {
                // Create highlight circle
                const highlightGeometry = new THREE.CircleGeometry(0.7, 32)
                const highlightMaterial = new THREE.MeshBasicMaterial({
                    color: 0xff0000,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide,
                })
                const highlight = new THREE.Mesh(
                    highlightGeometry,
                    highlightMaterial
                )
                highlight.position.copy(mesh.position)
                highlight.position.z = -0.1 // Place slightly behind the node
                scene.add(highlight)
                hoverHighlightRef.current = highlight

                // Highlight neighbors of the hovered node
                highlightNeighbors(mesh)
            } else {
                // If no node is hovered, revert to highlighting neighbors of the selected node
                if (selectedNode) {
                    highlightNeighbors(selectedNode)
                }
            }
        },
        [scene, selectedNode]
    )

    // Function to highlight neighbors of a node
    const highlightNeighbors = useCallback(
        (node: THREE.Mesh | null) => {
            if (!node) {
                // Reset all nodes to default appearance if no node is provided
                nodesRef.current.forEach((forceNode) => {
                    if (forceNode.mesh !== selectedNode) {
                        ;(
                            forceNode.mesh.material as THREE.MeshBasicMaterial
                        ).color.set(0x4a90e2)
                        forceNode.mesh.scale.set(1, 1, 1)
                    }
                })

                // Set selected node appearance if it exists
                if (selectedNode) {
                    ;(
                        selectedNode.material as THREE.MeshBasicMaterial
                    ).color.set(0xff0000)
                }

                return
            }

            // First reset all nodes to default appearance
            nodesRef.current.forEach((forceNode) => {
                if (
                    forceNode.mesh !== selectedNode &&
                    forceNode.mesh !== node
                ) {
                    ;(
                        forceNode.mesh.material as THREE.MeshBasicMaterial
                    ).color.set(0x4a90e2)
                    forceNode.mesh.scale.set(1, 1, 1)
                }
            })

            // Set selected node appearance
            if (selectedNode) {
                ;(selectedNode.material as THREE.MeshBasicMaterial).color.set(
                    0xff0000
                )
            }

            // If the node we're highlighting is different from the selected node, give it a distinct appearance
            if (node !== selectedNode) {
                ;(node.material as THREE.MeshBasicMaterial).color.set(0xff0000)
            }

            // Find and highlight neighbors of the node
            const neighbors = new Set<THREE.Mesh>()

            // Find all edges connected to the node
            edgesRef.current.forEach((edge) => {
                if (edge.source.mesh === node) {
                    neighbors.add(edge.target.mesh)
                } else if (edge.target.mesh === node) {
                    neighbors.add(edge.source.mesh)
                }
            })

            // Apply faded red color to neighbors
            neighbors.forEach((neighborMesh) => {
                // Apply a faded red color (pink-ish)
                ;(neighborMesh.material as THREE.MeshBasicMaterial).color.set(
                    0xff9999
                )
            })
        },
        [nodesRef, edgesRef, selectedNode]
    )

    // Update selected node appearance
    useEffect(() => {
        // Only highlight neighbors of selected node if no node is being hovered
        if (!_hoveredNode) {
            highlightNeighbors(selectedNode)
        }

        // Start pulsing animation for selected node
        if (selectedNode) {
            // Start pulsing animation
            const animatePulse = () => {
                if (!selectedNode) return

                // Pulse between 0.9 and 1.2 scale
                pulseScaleRef.current += 0.02 * pulseDirectionRef.current

                if (pulseScaleRef.current >= 1.2) {
                    pulseScaleRef.current = 1.2
                    pulseDirectionRef.current = -1
                } else if (pulseScaleRef.current <= 0.9) {
                    pulseScaleRef.current = 0.9
                    pulseDirectionRef.current = 1
                }

                selectedNode.scale.set(
                    pulseScaleRef.current,
                    pulseScaleRef.current,
                    1
                )

                pulseAnimationRef.current = requestAnimationFrame(animatePulse)
            }

            // Start animation
            pulseScaleRef.current = 1
            pulseDirectionRef.current = 1
            pulseAnimationRef.current = requestAnimationFrame(animatePulse)
        }

        // Cleanup animation on deselection
        return () => {
            if (pulseAnimationRef.current) {
                cancelAnimationFrame(pulseAnimationRef.current)
            }
        }
    }, [selectedNode, _hoveredNode, highlightNeighbors])

    // Automatically expand nodes until a target count is reached
    const autoExpandNodes = useCallback(
        async (start: THREE.Mesh, targetCount: number): Promise<void> => {
            let totalNodes = 1
            const queue: THREE.Mesh[] = [start]
            const expanded = new Set<string>()

            while (queue.length > 0 && totalNodes < targetCount) {
                const current = queue.shift()!
                if (expanded.has(current.userData.element)) continue
                const response = await getNeighbors(current.userData.element)
                if (!response.success) continue
                expanded.add(current.userData.element)

                // Initialize childNodes array if it doesn't exist
                if (!current.userData.childNodes) {
                    current.userData.childNodes = []
                }

                let count = 0
                for (const level of response.result) {
                    for (const [neighborElement, similarity] of level) {
                        if (totalNodes >= targetCount) break
                        const angle = Math.random() * Math.PI * 2
                        const radius = 1 + Math.random() * 2
                        const x = current.position.x + Math.cos(angle) * radius
                        const y = current.position.y + Math.sin(angle) * radius
                        const neighbor = createNode(
                            neighborElement,
                            x,
                            y,
                            current
                        )
                        if (neighbor) {
                            neighbor.userData.similarity = similarity
                            createEdge(current, neighbor, similarity, true)
                            queue.push(neighbor)
                            totalNodes++
                            count++
                        }
                    }
                }
                current.userData.expanded = true
                current.userData.displayState = "expanded"
                current.userData.neighborCount = count
            }

            // Make sure the start node is selected after expansion
            setSelectedNode(start)

            // Highlight the neighbors of the start node
            highlightNeighbors(start)

            return Promise.resolve()
        },
        [
            createNode,
            createEdge,
            getNeighbors,
            setSelectedNode,
            highlightNeighbors,
        ]
    )

    // Expand a node when clicked
    const expandNode = useCallback(
        async (node: THREE.Mesh) => {
            // Set the node as selected to trigger neighbor highlighting
            setSelectedNode(node)

            // If we've already fetched neighbors but they're just hidden, show them
            if (
                node.userData.expanded &&
                node.userData.displayState === "collapsed"
            ) {
                // Just change display state to show existing neighbors
                node.userData.displayState = "expanded"

                // Show all child nodes and their edges
                if (
                    node.userData.childNodes &&
                    node.userData.childNodes.length > 0
                ) {
                    node.userData.childNodes.forEach(
                        (childNode: THREE.Mesh) => {
                            // Make child node visible
                            childNode.visible = true

                            // Find and make edges visible
                            edgesRef.current.forEach((edge) => {
                                if (
                                    (edge.source.mesh === node &&
                                        edge.target.mesh === childNode) ||
                                    (edge.source.mesh === childNode &&
                                        edge.target.mesh === node)
                                ) {
                                    edge.line.visible = true
                                }
                            })
                        }
                    )
                }

                // Reapply current layout if not using force-directed
                if (currentLayout !== "force") {
                    const forceNode = nodesRef.current.find(
                        (n) => n.mesh === node
                    )
                    if (forceNode) {
                        setTimeout(
                            () => applyLayout(currentLayout, forceNode),
                            100
                        )
                    }
                }

                return
            }

            // If we haven't fetched neighbors yet, get them
            if (!node.userData.expanded) {
                const response = await getNeighbors(node.userData.element)
                if (!response.success) return
                let count = 0
                for (const level of response.result) {
                    for (const [neighborElement, similarity] of level) {
                        if (count >= maxNodes) break
                        const angle = Math.random() * Math.PI * 2
                        const radius = 1 + Math.random() * 2
                        const x = node.position.x + Math.cos(angle) * radius
                        const y = node.position.y + Math.sin(angle) * radius
                        const neighbor = createNode(neighborElement, x, y, node)
                        if (neighbor) {
                            neighbor.userData.similarity = similarity
                            createEdge(node, neighbor, similarity, true)
                            count++
                        }
                    }
                }
                node.userData.expanded = true
                node.userData.displayState = "expanded"
                node.userData.neighborCount = count

                // Reapply current layout if not using force-directed
                if (currentLayout !== "force") {
                    const forceNode = nodesRef.current.find(
                        (n) => n.mesh === node
                    )
                    if (forceNode) {
                        setTimeout(
                            () => applyLayout(currentLayout, forceNode),
                            100
                        )
                    }
                }
            }
        },
        [
            createNode,
            createEdge,
            getNeighbors,
            maxNodes,
            edgesRef,
            nodesRef,
            currentLayout,
            applyLayout,
            setSelectedNode,
        ]
    )

    // Collapse a node (hide its neighbors)
    const collapseNode = useCallback(
        (node: THREE.Mesh) => {
            if (node.userData.displayState === "collapsed") return

            // Set display state to collapsed
            node.userData.displayState = "collapsed"

            // Hide all child nodes and their edges
            if (
                node.userData.childNodes &&
                node.userData.childNodes.length > 0
            ) {
                node.userData.childNodes.forEach((childNode: THREE.Mesh) => {
                    // Hide child node
                    childNode.visible = false

                    // Hide edges connected to this child
                    edgesRef.current.forEach((edge) => {
                        if (
                            (edge.source.mesh === node &&
                                edge.target.mesh === childNode) ||
                            (edge.source.mesh === childNode &&
                                edge.target.mesh === node)
                        ) {
                            edge.line.visible = false
                        }
                    })

                    // Recursively collapse any expanded children
                    if (childNode.userData.displayState === "expanded") {
                        collapseNode(childNode)
                    }
                })
            }
        },
        [edgesRef]
    )

    // Handle node clicks (set as selected and toggle expand/collapse)
    const handleNodeClick = useCallback(
        (mesh: THREE.Mesh) => {
            setSelectedNode(mesh)

            // If no node is currently hovered, highlight the neighbors of the selected node
            if (!_hoveredNode) {
                highlightNeighbors(mesh)
            }

            // If node is collapsed, expand it
            if (mesh.userData.displayState === "collapsed") {
                expandNode(mesh)
            } else {
                // If node is not expanded (neighbors not fetched), expand it
                if (!mesh.userData.expanded) {
                    expandNode(mesh)
                }
                // Otherwise, just select it without changing state
            }
        },
        [expandNode, _hoveredNode, highlightNeighbors]
    )

    // Hook up canvas events
    useCanvasEvents(
        canvasRef,
        camera,
        scene,
        handleNodeClick,
        handleNodeHover,
        // Update hover label
        (mesh, x, y) => {
            if (mesh) {
                // Truncate very long element names
                const elementName = mesh.userData.element
                const truncatedText =
                    elementName.length > 50
                        ? elementName.substring(0, 47) + "..."
                        : elementName

                setHoverLabel({
                    visible: true,
                    text: truncatedText,
                    x,
                    y,
                })
            } else {
                setHoverLabel({ visible: false, text: "", x, y })
            }
        }
    )

    // Start the simulation once the scene is ready
    useEffect(() => {
        if (scene && camera && renderer) {
            startSimulation(scene, camera, renderer, forceSimulationActive)
        }
    }, [scene, camera, renderer, startSimulation])

    // Render initial node and auto-expand on mount
    useEffect(() => {
        if (scene) {
            const initial = createNode(initialElement, 0, 0)
            if (initial) {
                // Make sure the initial node has the correct display state
                initial.userData.displayState = "expanded"
                // Select the initial node immediately
                setSelectedNode(initial)
                autoExpandNodes(initial, initialNodes).then(() => {
                    // Apply the current layout after auto-expanding if not using force-directed
                    if (currentLayout !== "force") {
                        const rootNode = nodesRef.current.find(
                            (n) => n.mesh === initial
                        )
                        if (rootNode) {
                            setTimeout(
                                () => applyLayout(currentLayout, rootNode),
                                200
                            )
                        }
                    }
                })
            }
        }
    }, [
        scene,
        initialElement,
        initialNodes,
        createNode,
        autoExpandNodes,
        currentLayout,
        applyLayout,
        nodesRef,
    ])

    // Reset the visualization to just the initial element
    const resetVisualization = useCallback(() => {
        if (!scene) return

        // Clear selection and hover states
        setSelectedNode(null)
        setHoveredNode(null)
        setHoverLabel({ visible: false, text: "", x: 0, y: 0 })

        // Remove hover highlight if it exists
        if (hoverHighlightRef.current) {
            scene.remove(hoverHighlightRef.current)
            hoverHighlightRef.current = null
        }

        // Reset all node colors to default before removing them
        nodesRef.current.forEach((node) => {
            ;(node.mesh.material as THREE.MeshBasicMaterial).color.set(0x4a90e2)
            node.mesh.scale.set(1, 1, 1)
        })

        // Remove all nodes and edges from the scene
        const nodesToRemove = nodesRef.current.map((node) => node.mesh)
        nodesToRemove.forEach((mesh) => {
            scene.remove(mesh)
            // Dispose of geometries and materials to prevent memory leaks
            if (mesh.geometry) mesh.geometry.dispose()
            if (mesh.material) {
                if (Array.isArray(mesh.material)) {
                    mesh.material.forEach((material) => material.dispose())
                } else {
                    mesh.material.dispose()
                }
            }
        })

        // Remove all edges
        edgesRef.current.forEach((edge) => {
            scene.remove(edge.line)
            if (edge.line.geometry) edge.line.geometry.dispose()
            if (edge.line.material) {
                if (Array.isArray(edge.line.material)) {
                    edge.line.material.forEach((material) => material.dispose())
                } else {
                    edge.line.material.dispose()
                }
            }
        })

        // Clear references
        nodesRef.current = []
        edgesRef.current = []

        // Reset rendered elements tracking
        setRenderedElements(new Set())

        // Create a new initial node and auto-expand
        const initial = createNode(initialElement, 0, 0)
        if (initial) {
            initial.userData.displayState = "expanded"
            autoExpandNodes(initial, initialNodes).then(() => {
                // Apply the current layout after auto-expanding
                if (currentLayout !== "force") {
                    const rootNode = nodesRef.current.find(
                        (n) => n.mesh === initial
                    )
                    if (rootNode) {
                        setTimeout(
                            () => applyLayout(currentLayout, rootNode),
                            200
                        )
                    }
                }
            })
        }

        // Reset the camera view
        resetView()
    }, [
        scene,
        nodesRef,
        edgesRef,
        createNode,
        autoExpandNodes,
        initialElement,
        initialNodes,
        resetView,
        currentLayout,
        applyLayout,
        setHoveredNode,
        setHoverLabel,
    ])

    // Copy vector to clipboard
    const copyVectorToClipboard = useCallback(async () => {
        if (!selectedNode) return

        try {
            const response = await getVector(selectedNode.userData.element)

            if (response.success) {
                const vectorString = JSON.stringify(response.result)
                await navigator.clipboard.writeText(vectorString)
                toast.success("Vector copied to clipboard")
            } else {
                toast.error("Failed to get vector")
            }
        } catch (error) {
            console.error("Error copying vector to clipboard:", error)
            toast.error("Error copying vector to clipboard")
        }
    }, [selectedNode, getVector])

    return (
        <div className="hnsw-viz-container">
            {errorMessage && (
                <div className="error-message">{errorMessage}</div>
            )}
            <canvas
                ref={canvasRef}
                className="hnsw-viz-canvas"
            />
            {hoverLabel.visible && (
                <div
                    className="hover-label"
                    style={{
                        position: "fixed", // Fixed positioning relative to viewport
                        left: `${hoverLabel.x}px`,
                        top: `${hoverLabel.y}px`,
                        maxWidth: "400px",
                        // Smart positioning logic:
                        // - By default, position to the right of the cursor
                        // - If near right edge of screen, position to the left of cursor
                        // - Vertically center the label with the cursor
                        // - If near bottom edge, position above the cursor
                        transform: `translate(${
                            hoverLabel.x + 250 > window.innerWidth
                                ? "-110%"
                                : "20px"
                        }, ${
                            hoverLabel.y + 50 > window.innerHeight
                                ? "-100%"
                                : "-50%"
                        })`,
                        // Add a subtle pointer to indicate which node the label belongs to
                        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.3)",
                    }}
                >
                    {hoverLabel.text}
                </div>
            )}
            <div className="node-info-card">
                <Card>
                    {selectedNode && (
                        <div>
                            <CardHeader className="pb-2">
                                <div className="flex space-x-2 items-center">
                                    <div className="rounded-full bg-red-500 w-4 h-4"></div>
                                    <h3 className="text-lg font-semibold">
                                        Element Details
                                    </h3>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid gap-2">
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-muted-foreground">
                                            Element
                                        </span>
                                        <span className="font-mono">
                                            {selectedNode.userData.element}
                                        </span>
                                    </div>

                                    {selectedNode.userData.similarity !==
                                        null && (
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm text-muted-foreground">
                                                Similarity
                                            </span>
                                            <span>
                                                {selectedNode.userData.similarity.toFixed(
                                                    4
                                                )}
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-muted-foreground">
                                            Neighbors
                                        </span>
                                        <span>
                                            {
                                                selectedNode.userData
                                                    .neighborCount
                                            }
                                        </span>
                                    </div>

                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm text-muted-foreground">
                                            Status
                                        </span>
                                        <span>
                                            {selectedNode.userData.expanded
                                                ? selectedNode.userData
                                                      .displayState ===
                                                  "expanded"
                                                    ? "Expanded"
                                                    : "Collapsed"
                                                : "Not Expanded"}
                                        </span>
                                    </div>

                                    <div className="flex gap-2 mt-2">
                                        {!selectedNode.userData.expanded && (
                                            <Button
                                                onClick={() =>
                                                    expandNode(selectedNode)
                                                }
                                                size="sm"
                                            >
                                                Expand Node
                                            </Button>
                                        )}

                                        {selectedNode.userData.expanded &&
                                            selectedNode.userData
                                                .displayState ===
                                                "expanded" && (
                                                <Button
                                                    onClick={() =>
                                                        collapseNode(
                                                            selectedNode
                                                        )
                                                    }
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    Collapse Node
                                                </Button>
                                            )}

                                        {selectedNode.userData.expanded &&
                                            selectedNode.userData
                                                .displayState ===
                                                "collapsed" && (
                                                <Button
                                                    onClick={() =>
                                                        expandNode(selectedNode)
                                                    }
                                                    size="sm"
                                                >
                                                    Show Neighbors
                                                </Button>
                                            )}

                                        <Button
                                            onClick={copyVectorToClipboard}
                                            size="sm"
                                            variant="secondary"
                                        >
                                            Copy Vector
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </div>
                    )}
                    <div className="space-y-4 px-4 pb-4">
                        <div className="space-y-2">
                            <Label htmlFor="layout-select">
                                Layout Algorithm
                            </Label>
                            <Select
                                value={currentLayout}
                                onValueChange={(value: LayoutAlgorithmType) => {
                                    applyLayout(
                                        value,
                                        selectedNode
                                            ? nodesRef.current.find(
                                                  (n) => n.mesh === selectedNode
                                              ) || undefined
                                            : undefined
                                    )
                                }}
                            >
                                <SelectTrigger id="layout-select">
                                    <SelectValue placeholder="Select layout" />
                                </SelectTrigger>
                                <SelectContent>
                                    {Object.entries(layouts).map(
                                        ([key, layout]) => (
                                            <SelectItem key={key} value={key}>
                                                {layout.name}
                                            </SelectItem>
                                        )
                                    )}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                {layouts[currentLayout].description}
                            </p>
                        </div>

                        {selectedNode && currentLayout === "radial" && (
                            <Button
                                onClick={() => {
                                    const rootNode = nodesRef.current.find(
                                        (n) => n.mesh === selectedNode
                                    )
                                    if (rootNode) {
                                        applyLayout(currentLayout, rootNode)
                                        toast.success(
                                            `Applied ${layouts[currentLayout].name} layout with selected node as root`
                                        )
                                    }
                                }}
                                variant="outline"
                                size="sm"
                                className="w-full"
                            >
                                Use Selected as Root
                            </Button>
                        )}

                        <Separator />

                        <Button
                            onClick={() => setIsResetDialogOpen(true)}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                        >
                            Reset Graph
                        </Button>
                    </div>
                </Card>
            </div>
            {/* Reset Confirmation Dialog */}
            <AlertDialog
                open={isResetDialogOpen}
                onOpenChange={setIsResetDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Reset Graph</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will remove all nodes except the initial one
                            and restart the visualization. Are you sure you want
                            to continue?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                resetVisualization()
                                setIsResetDialogOpen(false)
                            }}
                        >
                            Reset
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            <style jsx global>{`
                /* Ensure parent containers can pass down height */
                :root {
                    --hnsw-viz-height: 100%;
                }
                
                /* When HNSWViz is used in a page, ensure the page container has full height */
                html, body, #__next, main {
                    height: 100%;
                    min-height: 100%;
                }
            `}</style>
            <style jsx>{`
                .hnsw-viz-container {
                    position: relative;
                    width: 100%;
                    height: var(--hnsw-viz-height, 100%);
                    min-height: 100%;
                    display: flex;
                    flex-direction: column;
                }
                .hnsw-viz-canvas {
                    display: block;
                    width: 100%;
                    flex: 1 1 auto;
                }
                .error-message {
                    position: absolute;
                    top: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: rgba(255, 0, 0, 0.8);
                    color: white;
                    padding: 8px 12px;
                    border-radius: 4px;
                    z-index: 10;
                    font-family: monospace;
                }
                .node-info-card {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10;
                    width: 300px;
                    max-height: 80vh;
                    overflow-y: auto;
                }
                .controls-panel {
                    position: absolute;
                    bottom: 10px;
                    right: 10px;
                    background: rgba(255, 255, 255, 0.9);
                    border-radius: 4px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
                    z-index: 10;
                    width: 300px;
                }
                .hover-label {
                    background-color: rgba(0, 0, 0, 0.95);
                    color: white;
                    padding: 10px 14px;
                    border-radius: 6px;
                    z-index: 20;
                    font-family: monospace;
                    font-size: 15px;
                    word-break: break-all;
                    pointer-events: none;
                    transition: opacity 0.2s ease, transform 0.1s ease;
                    white-space: nowrap;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
            `}</style>
        </div>
    )
}

export default HNSWViz
