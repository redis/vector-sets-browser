"use client"

import React, { useRef, useState, useEffect, useCallback } from "react"
import * as THREE from "three"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
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

import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { ZoomIn, ZoomOut, Search } from "lucide-react"
// Projection libraries
import { UMAP } from "umap-js"
import { PCA } from "ml-pca"
import { VLinkResponse } from "./types"

// Dynamic import for TSNE
let TSNE: any = null

type ColorScheme = typeof COLORS_REDIS_DARK | typeof COLORS_REDIS_LIGHT

const COLORS_REDIS_LIGHT = {
    NODE: {
        DEFAULT: 0x1a3b4c, // Default blue color for nodes
        SELECTED: 0xff4438, // Red color for selected nodes
        NEIGHBOR: 0xff918a, // Pink color for neighbor nodes
        HOVER_HIGHLIGHT: 0xd6ff18, // Red color for hover highlight effect
    },
    EDGE: {
        DEFAULT: 0x4a90e2, // Default blue color for edges
    },
    BACKGROUND: "#f5f5f5", // Light gray background color
} as const

const COLORS_REDIS_DARK = {
    NODE: {
        DEFAULT: 0xffffff, // Default white color for nodes
        SELECTED: 0xd6ff18, // lime color for selected nodes
        NEIGHBOR: 0xe4ff6a, // lime color for neighbor nodes
        HOVER_HIGHLIGHT: 0xd6ff18, // Red color for hover highlight effect
    },
    EDGE: {
        DEFAULT: 0xf3ffbb, // Default blue color for edges
    },
    BACKGROUND: "#0d1e26", // Light gray background color
} as const

// Color constants
const COLORS_CLASSIC = {
    NODE: {
        DEFAULT: 0x4a90e2, // Default blue color for nodes
        SELECTED: 0xff0000, // Red color for selected nodes
        NEIGHBOR: 0xff9999, // Pink color for neighbor nodes
        HOVER_HIGHLIGHT: 0xff0000, // Red color for hover highlight effect
    },
    EDGE: {
        DEFAULT: 0x4a90e2, // Default blue color for edges
    },
    BACKGROUND: "#f5f5f5", // Light gray background color
} as const

// Color constants
let COLORS: ColorScheme = COLORS_REDIS_DARK

// Local storage key for color scheme
const COLOR_SCHEME_STORAGE_KEY = "hnsw_color_scheme"

//
// Type Definitions
//
interface HNSWVizPureProps {
    keyName: string
    initialElement: string
    maxNodes?: number
    initialNodes?: number
    getNeighbors: (
        keyName: string,
        element: string,
        count: number,
        withEmbeddings?: boolean
    ) => Promise<VLinkResponse>
}

interface ForceNode {
    mesh: THREE.Mesh
    velocity: THREE.Vector2
    force: THREE.Vector2
    vector: number[] | undefined // Make vector an explicit part of the interface
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
type LayoutAlgorithmType = "force" | "umap" | "pca"

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
    // Add references for guide lines
    const guideLineRefsRef = useRef<{
        horizontalLine: THREE.Line | null;
        verticalLine: THREE.Line | null;
        horizontalTicks: THREE.Line[];
        verticalTicks: THREE.Line[];
    }>({
        horizontalLine: null,
        verticalLine: null,
        horizontalTicks: [],
        verticalTicks: []
    });

    useEffect(() => {
        if (!canvasRef.current) return

        // Create scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(COLORS.BACKGROUND)

        // Add guide lines at the origin
        const createGuideLines = () => {
            // Define the size of the grid
            const gridSize = 50;
            
            // Determine if we're in dark mode based on the background color
            const bgColor = new THREE.Color(COLORS.BACKGROUND);
            const isDark = bgColor.r < 0.5 && bgColor.g < 0.5 && bgColor.b < 0.5;
            const lineColor = isDark ? 0xffffff : 0x000000;
            
            // Create horizontal line
            const horizontalPoints = [
                new THREE.Vector3(-gridSize, 0, -0.1),
                new THREE.Vector3(gridSize, 0, -0.1)
            ];
            const horizontalGeometry = new THREE.BufferGeometry().setFromPoints(horizontalPoints);
            const horizontalMaterial = new THREE.LineDashedMaterial({
                color: lineColor,
                transparent: true,
                opacity: 0.2,
                dashSize: 0.5,
                gapSize: 0.3,
            });
            const horizontalLine = new THREE.Line(horizontalGeometry, horizontalMaterial);
            horizontalLine.computeLineDistances(); // Required for dashed lines
            scene.add(horizontalLine);
            guideLineRefsRef.current.horizontalLine = horizontalLine;
            
            // Create vertical line
            const verticalPoints = [
                new THREE.Vector3(0, -gridSize, -0.1),
                new THREE.Vector3(0, gridSize, -0.1)
            ];
            const verticalGeometry = new THREE.BufferGeometry().setFromPoints(verticalPoints);
            const verticalMaterial = new THREE.LineDashedMaterial({
                color: lineColor,
                transparent: true,
                opacity: 0.2,
                dashSize: 0.5,
                gapSize: 0.3,
            });
            const verticalLine = new THREE.Line(verticalGeometry, verticalMaterial);
            verticalLine.computeLineDistances(); // Required for dashed lines
            scene.add(verticalLine);
            guideLineRefsRef.current.verticalLine = verticalLine;
            
            // Add tick marks
            const tickSize = 0.2;
            const tickSpacing = 5;
            const tickOpacity = 0.3;
            
            // Clear previous ticks arrays
            guideLineRefsRef.current.horizontalTicks = [];
            guideLineRefsRef.current.verticalTicks = [];
            
            // Horizontal tick marks
            for (let i = -gridSize; i <= gridSize; i += tickSpacing) {
                if (i === 0) continue; // Skip the origin
                
                const tickPoints = [
                    new THREE.Vector3(i, -tickSize, -0.1),
                    new THREE.Vector3(i, tickSize, -0.1)
                ];
                const tickGeometry = new THREE.BufferGeometry().setFromPoints(tickPoints);
                const tickMaterial = new THREE.LineBasicMaterial({
                    color: lineColor,
                    transparent: true,
                    opacity: tickOpacity
                });
                const tick = new THREE.Line(tickGeometry, tickMaterial);
                scene.add(tick);
                guideLineRefsRef.current.horizontalTicks.push(tick);
            }
            
            // Vertical tick marks
            for (let i = -gridSize; i <= gridSize; i += tickSpacing) {
                if (i === 0) continue; // Skip the origin
                
                const tickPoints = [
                    new THREE.Vector3(-tickSize, i, -0.1),
                    new THREE.Vector3(tickSize, i, -0.1)
                ];
                const tickGeometry = new THREE.BufferGeometry().setFromPoints(tickPoints);
                const tickMaterial = new THREE.LineBasicMaterial({
                    color: lineColor,
                    transparent: true,
                    opacity: tickOpacity
                });
                const tick = new THREE.Line(tickGeometry, tickMaterial);
                scene.add(tick);
                guideLineRefsRef.current.verticalTicks.push(tick);
            }
        };

        // Call the function to create guide lines
        createGuideLines();

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
        const padding = 0.7

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

    // Function to update guide line colors based on current color scheme
    const updateGuideLineColors = useCallback((isDark: boolean) => {
        const lineColor = isDark ? 0xffffff : 0x000000;
        
        // Update horizontal line
        if (guideLineRefsRef.current.horizontalLine) {
            (guideLineRefsRef.current.horizontalLine.material as THREE.LineDashedMaterial).color.set(lineColor);
            (guideLineRefsRef.current.horizontalLine.material as THREE.LineDashedMaterial).needsUpdate = true;
        }
        
        // Update vertical line
        if (guideLineRefsRef.current.verticalLine) {
            (guideLineRefsRef.current.verticalLine.material as THREE.LineDashedMaterial).color.set(lineColor);
            (guideLineRefsRef.current.verticalLine.material as THREE.LineDashedMaterial).needsUpdate = true;
        }
        
        // Update horizontal ticks
        guideLineRefsRef.current.horizontalTicks.forEach(tick => {
            (tick.material as THREE.LineBasicMaterial).color.set(lineColor);
            (tick.material as THREE.LineBasicMaterial).needsUpdate = true;
        });
        
        // Update vertical ticks
        guideLineRefsRef.current.verticalTicks.forEach(tick => {
            (tick.material as THREE.LineBasicMaterial).color.set(lineColor);
            (tick.material as THREE.LineBasicMaterial).needsUpdate = true;
        });
    }, []);

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
        updateGuideLineColors,
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
            vector: mesh.userData.vector, // Initialize vector from userData
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
    fitCameraToNodes: () => void,
    canvasRef: React.RefObject<HTMLCanvasElement>
) {
    // Get stored layout or default to "pca"
    const storedLayout =
        typeof window !== "undefined"
            ? localStorage.getItem("hnswVizLayout")
            : null
    const [currentLayout, setCurrentLayout] = useState<LayoutAlgorithmType>(
        (storedLayout as LayoutAlgorithmType) || "pca"
    )
    const animationFrameId = useRef<number>()
    const forceSimulationActive = useRef<boolean>(true)
    const [isProjectionRunning, setIsProjectionRunning] =
        useState<boolean>(false)

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

    // Helper function to normalize and scale projection coordinates
    const normalizeAndScaleProjection = (
        projection: number[][],
        scale: number = 10
    ) => {
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
            canvasRef.current?.parentElement?.clientWidth || window.innerWidth
        const canvasHeight =
            canvasRef.current?.parentElement?.clientHeight || window.innerHeight
        const windowAspectRatio = canvasWidth / canvasHeight

        // Calculate aspect ratio of the data
        const dataAspectRatio = rangeX / rangeY

        // Adjust scale based on number of nodes to prevent overcrowding
        // Use a gentler logarithmic scaling that plateaus more quickly
        const nodeCountFactor = Math.log(projection.length + 1) / Math.log(20) // Changed from log(10) to log(20)
        const baseScale = scale * (1 + nodeCountFactor * 0.2) // Reduced from 0.5 to 0.2

        // Calculate scale factors to fill the window while maintaining relative distances
        // but keeping the original scale for the smaller dimension
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
    }

    // UMAP layout - uses UMAP algorithm for dimensionality reduction
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
                // toast.error(
                //     "UMAP requires at least 2 nodes. Please expand the graph first."
                // )
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
                        // Use immediate position update instead of lerp for final positions
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
                    `Error in UMAP projection: ${
                        error instanceof Error ? error.message : "Unknown error"
                    }`
                )
            } finally {
                setIsProjectionRunning(false)
            }
        },
        animate: false, // Set to false since we don't need continuous animation
    }

    // PCA layout (as a substitute for PaCMAP) - uses PCA for dimensionality reduction
    const pcaLayout: LayoutAlgorithm = {
        name: "PCA (PaCMAP alt)",
        description:
            "Principal Component Analysis - linear projection that preserves global variance. Fast but may not capture complex relationships between points.",
        apply: async (nodes) => {
            forceSimulationActive.current = false

            if (nodes.length === 0) return
            if (isProjectionRunning) return

            // PCA requires at least 2 nodes to work properly
            if (nodes.length < 2) {
                // toast.error(
                //     "PCA requires at least 2 nodes. Please expand the graph first."
                // )
                return
            }

            setIsProjectionRunning(true)

            try {
                // Prepare data for PCA
                const vectors: number[][] = []
                const nodeOrder: ForceNode[] = []

                nodes.forEach((node) => {
                    if (node.vector) {
                        vectors.push(node.vector)
                        nodeOrder.push(node)
                    }
                })

                if (vectors.length === 0) {
                    toast.error("No valid vectors for PCA projection")
                    setIsProjectionRunning(false)
                    return
                }

                // Run PCA
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
                        // Use immediate position update instead of lerp for final positions
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
        animate: false, // Set to false since we don't need continuous animation
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

            ;(window as any).lastLayoutChange = now

            // Only update layout type if it's different
            if (currentLayout !== layoutType) {
                setCurrentLayout(layoutType)
                // Store the layout preference
                if (typeof window !== "undefined") {
                    localStorage.setItem("hnswVizLayout", layoutType)
                }
            }

            // If switching to a projection method, show a toast with instructions
            if (["umap", "pca"].includes(layoutType)) {
                // toast.info(
                //     `Running ${layouts[layoutType].name} projection. This may take a moment...`
                // )

                // Clear any previous attempt flags for this layout if we're explicitly selecting it
                const layoutKey = `${layoutType}_${nodesRef.current.length}`
                const attemptedKey = `attempted_${layoutKey}`
                ;(window as any)[attemptedKey] = false
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

    // Start animation loop for layouts that need continuous updates
    useEffect(() => {
        const layout = layouts[currentLayout]

        if (layout.animate) {
            const animate = () => {
                // Only apply non-force layouts here that are NOT projection-based
                if (
                    currentLayout !== "force" &&
                    currentLayout !== "umap" &&
                    currentLayout !== "pca" &&
                    !isProjectionRunning
                ) {
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
    }, [
        currentLayout,
        layouts,
        nodesRef,
        edgesRef,
        scene,
        camera,
        renderer,
        isProjectionRunning,
    ])

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
                ;(window as any)[attemptedKey] = true

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

//
// Node Management Hook (Data fetching and expansion)
//
function useNodeManager(
    keyName: string,
    maxNodes: number,
    getNeighbors: (
        keyName: string,
        element: string,
        count: number,
        withEmbeddings?: boolean
    ) => Promise<VLinkResponse>
) {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const fetchNeighbors = useCallback(
        async (element: string): Promise<VLinkResponse> => {
            try {
                const response = await getNeighbors(
                    keyName,
                    element,
                    maxNodes,
                    true
                )
                if (!element) {
                    setErrorMessage("No element provided")
                    return {
                        success: false,
                        result: [],
                    }
                }
                if (!response.success) {
                    setErrorMessage("Failed to fetch neighbors")
                    return {
                        success: false,
                        result: [],
                    }
                }
                setErrorMessage(null)
                return response
            } catch (error) {
                console.error("Error fetching neighbors:", error)
                setErrorMessage(
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch neighbors"
                )
                return {
                    success: false,
                    result: [],
                }
            }
        },
        [keyName, maxNodes, getNeighbors]
    )

    return { errorMessage, fetchNeighbors }
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
    const lastClickTimeRef = useRef<number>(0)
    const lastClickedNodeRef = useRef<THREE.Mesh | null>(null)
    
    // Add state for panning
    const isDraggingRef = useRef<boolean>(false)
    const previousMousePositionRef = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !camera || !scene) return

        const onMouseMove = (event: MouseEvent) => {
            const rect = canvas.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            
            // Handle panning when dragging
            if (isDraggingRef.current && previousMousePositionRef.current) {
                // Calculate how much the mouse has moved
                const deltaX = event.clientX - previousMousePositionRef.current.x
                const deltaY = event.clientY - previousMousePositionRef.current.y
                
                // Convert screen space delta to world space delta based on current zoom level
                const aspect = canvas.width / canvas.height
                const worldDeltaX = (deltaX / canvas.width) * (camera.right - camera.left)
                const worldDeltaY = (deltaY / canvas.height) * (camera.top - camera.bottom)
                
                // Move the camera in the opposite direction of the mouse movement
                camera.position.x -= worldDeltaX
                camera.position.y += worldDeltaY
                
                // Update the previous position
                previousMousePositionRef.current = { x: event.clientX, y: event.clientY }
                
                // Skip raycasting during panning for better performance
                return
            }
            
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
            // Skip click handling if we were dragging
            if (isDraggingRef.current) {
                return
            }
            
            const rect = canvas.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            raycaster.setFromCamera(mouse, camera)
            const intersects = raycaster.intersectObjects(scene.children)
            const clicked = intersects.find((i) => i.object.userData.isNode)

            if (clicked) {
                const clickedNode = clicked.object as THREE.Mesh
                const now = Date.now()
                const timeSinceLastClick = now - lastClickTimeRef.current
                const isDoubleClick =
                    timeSinceLastClick < 300 &&
                    clickedNode === lastClickedNodeRef.current

                if (isDoubleClick) {
                    // Force expand on double click, regardless of current state
                    clickedNode.userData.expanded = false
                    clickedNode.userData.displayState = "expanded"
                    onNodeClick(clickedNode)
                } else {
                    // Single click behavior - just select the node
                    onNodeClick(clickedNode)
                }

                lastClickTimeRef.current = now
                lastClickedNodeRef.current = clickedNode
            }
        }
        
        // Add mouse down handler for panning
        const onMouseDown = (event: MouseEvent) => {
            // Only start dragging if not clicking on a node
            const rect = canvas.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
            raycaster.setFromCamera(mouse, camera)
            const intersects = raycaster.intersectObjects(scene.children)
            const clickedOnNode = intersects.find((i) => i.object.userData.isNode)
            
            if (!clickedOnNode) {
                isDraggingRef.current = true
                previousMousePositionRef.current = { x: event.clientX, y: event.clientY }
                canvas.style.cursor = 'grabbing'
            }
        }
        
        // Add mouse up handler to stop panning
        const onMouseUp = () => {
            isDraggingRef.current = false
            previousMousePositionRef.current = null
            canvas.style.cursor = 'default'
        }
        
        // Add mouse leave handler to stop panning if mouse leaves canvas
        const onMouseLeave = () => {
            isDraggingRef.current = false
            previousMousePositionRef.current = null
            canvas.style.cursor = 'default'
        }
        
        // Add wheel handler for zooming
        const onWheel = (event: WheelEvent) => {
            event.preventDefault()
            
            // Make zoom less sensitive and smoother
            // Reduce sensitivity by using a smaller factor
            const zoomSensitivity = 0.05
            const zoomAmount = event.deltaY * zoomSensitivity
            const zoomFactor = 1 + (zoomAmount > 0 ? Math.min(zoomAmount, 0.1) : Math.max(zoomAmount, -0.1))
            
            // Always zoom from center regardless of mouse position
            const currentWidth = camera.right - camera.left
            const currentHeight = camera.top - camera.bottom
            
            // Calculate new dimensions
            const newWidth = currentWidth * zoomFactor
            const newHeight = currentHeight * zoomFactor
            
            // Calculate how much to adjust the dimensions
            const widthDelta = (newWidth - currentWidth) / 2
            const heightDelta = (newHeight - currentHeight) / 2
            
            // Update camera frustum
            camera.left = camera.left - widthDelta
            camera.right = camera.right + widthDelta
            camera.top = camera.top + heightDelta
            camera.bottom = camera.bottom - heightDelta
            
            camera.updateProjectionMatrix()
        }

        canvas.addEventListener("mousemove", onMouseMove)
        canvas.addEventListener("click", onClick)
        canvas.addEventListener("mousedown", onMouseDown)
        canvas.addEventListener("mouseup", onMouseUp)
        canvas.addEventListener("mouseleave", onMouseLeave)
        canvas.addEventListener("wheel", onWheel, { passive: false })
        
        return () => {
            canvas.removeEventListener("mousemove", onMouseMove)
            canvas.removeEventListener("click", onClick)
            canvas.removeEventListener("mousedown", onMouseDown)
            canvas.removeEventListener("mouseup", onMouseUp)
            canvas.removeEventListener("mouseleave", onMouseLeave)
            canvas.removeEventListener("wheel", onWheel)
        }
    }, [canvasRef, camera, scene, onNodeClick, onNodeHover, updateHoverLabel])
}

//
// Main Component: HNSWViz
//
const HNSWVizPure: React.FC<HNSWVizPureProps> = ({
    keyName,
    initialElement,
    maxNodes = 100,
    initialNodes = 20,
    getNeighbors,
}) => {
    // Add color scheme state
    const [isDarkMode, setIsDarkMode] = useState(() => {
        // Try to get the stored value
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)
            return stored ? stored === "dark" : false // Default to dark if not set
        }
        return true // Default to dark mode
    })

    const [selectedNode, setSelectedNode] = useState<THREE.Mesh | null>(null)

    const {
        canvasRef,
        scene,
        camera,
        renderer,
        fitCameraToNodes,
        _zoomLevel: zoomLevel,
        _setManualZoom: setZoom,
        _isAutoZoom: isAutoZoom,
        _toggleAutoZoom: toggleAutoZoom,
        resetView,
        updateGuideLineColors,
    } = useThreeScene()

    const { errorMessage, fetchNeighbors } = useNodeManager(
        keyName,
        maxNodes,
        getNeighbors
    )

    const { nodesRef, edgesRef, addNode, addEdge, startSimulation } =
        useForceSimulator(scene, fitCameraToNodes)

    const {
        currentLayout,
        layouts,
        applyLayout,
        forceSimulationActive,
        isProjectionRunning,
    } = useLayoutManager(
        nodesRef,
        edgesRef,
        scene,
        camera,
        renderer,
        fitCameraToNodes,
        canvasRef
    )

    // Update COLORS when color scheme changes
    useEffect(() => {
        COLORS = isDarkMode ? COLORS_REDIS_DARK : COLORS_REDIS_LIGHT
        // Store the preference
        if (typeof window !== "undefined") {
            localStorage.setItem(
                COLOR_SCHEME_STORAGE_KEY,
                isDarkMode ? "dark" : "light"
            )
        }
        // Update all existing nodes and edges with new colors
        if (nodesRef.current) {
            nodesRef.current.forEach((node) => {
                if (node.mesh === selectedNode) {
                    ;(node.mesh.material as THREE.MeshBasicMaterial).color.set(
                        COLORS.NODE.SELECTED
                    )
                } else {
                    ;(node.mesh.material as THREE.MeshBasicMaterial).color.set(
                        COLORS.NODE.DEFAULT
                    )
                }
            })
        }
        if (edgesRef.current) {
            edgesRef.current.forEach((edge) => {
                ;(edge.line.material as THREE.LineBasicMaterial).color.set(
                    COLORS.EDGE.DEFAULT
                )
            })
        }
        // Update renderer background color and force render
        if (renderer && scene && camera) {
            scene.background = new THREE.Color(COLORS.BACKGROUND) // Update scene background directly
            renderer.setClearColor(COLORS.BACKGROUND) // Also update renderer clear color
            renderer.render(scene, camera) // Force a render
        }
        updateGuideLineColors(isDarkMode)
    }, [isDarkMode, selectedNode, renderer, scene, camera, nodesRef, edgesRef, updateGuideLineColors])

    const [_hoveredNode, setHoveredNode] = useState<THREE.Mesh | null>(null)
    const [renderedElements, setRenderedElements] = useState<Set<string>>(
        new Set()
    )
    // Get stored line visibility or default to false
    const storedShowLines =
        typeof window !== "undefined"
            ? localStorage.getItem("hnswVizShowLines")
            : null
    const [showLines, setShowLines] = useState<boolean>(
        storedShowLines === "true" ? true : false
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

    // State for card collapse
    const [isCardCollapsed, setIsCardCollapsed] = useState<boolean>(true)
    // Get stored pin state or default to false
    // const storedPinState =
    //     typeof window !== "undefined"
    //         ? localStorage.getItem("hnswVizCardPinned")
    //         : null
    const [isCardPinned, setIsCardPinned] = useState<boolean>(
        false
    )

    // Handle pin toggle
    const togglePin = useCallback(() => {
        const newPinState = !isCardPinned
        setIsCardPinned(newPinState)
        if (typeof window !== "undefined") {
            localStorage.setItem("hnswVizCardPinned", newPinState.toString())
        }
        // If unpinning, collapse the card
        if (!newPinState) {
            setIsCardCollapsed(true)
        }
    }, [isCardPinned])

    // Handle hover events
    const handleCardMouseEnter = useCallback(() => {
        if (!isCardPinned) {
            setIsCardCollapsed(false)
        }
    }, [isCardPinned])

    const handleCardMouseLeave = useCallback(() => {
        if (!isCardPinned) {
            setIsCardCollapsed(true)
        }
    }, [isCardPinned])

    // Create and add a node to the scene
    const createNode = useCallback(
        (
            element: string,
            x: number,
            y: number,
            parentNode?: THREE.Mesh,
            vector?: number[]
        ): THREE.Mesh | null => {
            if (renderedElements.has(element) || !scene) return null

            const geometry = new THREE.CircleGeometry(0.5, 32)
            const material = new THREE.MeshBasicMaterial({
                color: COLORS.NODE.DEFAULT,
                transparent: true,
                opacity: 0.8,
            })
            const circle = new THREE.Mesh(geometry, material)
            circle.position.set(x, y, 0)
            circle.userData = {
                element,
                isNode: true,
                expanded: false,
                displayState: "expanded",
                neighborCount: 0,
                similarity: null,
                parentNode: parentNode || null,
                childNodes: [],
                vector: vector, // Store vector in userData for easy access
            }
            scene.add(circle)
            const node = addNode(circle)
            node.vector = vector // Store vector in ForceNode object
            setRenderedElements((prev) => new Set(prev).add(element))

            // Add this node as a child to its parent
            if (parentNode) {
                if (!parentNode.userData.childNodes) {
                    parentNode.userData.childNodes = []
                }
                parentNode.userData.childNodes.push(circle)
            }

            // Only fit camera on initial nodes
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
                color: COLORS.EDGE.DEFAULT,
                transparent: true,
                opacity: Math.min(similarity, 0.8),
            })
            const line = new THREE.Line(geometry, material)

            // Set line visibility based on current showLines state
            line.visible = showLines

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
        [scene, nodesRef, addEdge, edgesRef, showLines]
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

            // If showLines is true, show all lines
            // If showLines is false but we're hovering over a node, show only lines connected to that node
            if (mesh) {
                // Show only lines connected to the hovered node
                edgesRef.current.forEach((edge) => {
                    const isConnectedToHoveredNode =
                        edge.source.mesh === mesh || edge.target.mesh === mesh

                    // Show lines connected to hovered node, hide others
                    edge.line.visible = isConnectedToHoveredNode
                })

                // Add hover highlight effect
                if (scene) {
                    // Create highlight circle
                    const highlightGeometry = new THREE.CircleGeometry(0.7, 32)
                    const highlightMaterial = new THREE.MeshBasicMaterial({
                        color: COLORS.NODE.HOVER_HIGHLIGHT,
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
                }

                // Highlight neighbors of the hovered node
                highlightNeighbors(mesh)
            } else {
                // When not hovering any node, restore line visibility based on showLines setting
                edgesRef.current.forEach((edge) => {
                    edge.line.visible = showLines
                })

                // If no node is hovered, revert to highlighting neighbors of the selected node
                if (selectedNode) {
                    highlightNeighbors(selectedNode)
                }
            }

            // Force a re-render to update line visibility
            if (scene && camera && renderer) {
                renderer.render(scene, camera)
            }
        },
        [scene, selectedNode, edgesRef, showLines, camera, renderer]
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
                        ).color.set(COLORS.NODE.DEFAULT)
                        forceNode.mesh.scale.set(1, 1, 1)
                    }
                })

                // Set selected node appearance if it exists
                if (selectedNode) {
                    ;(
                        selectedNode.material as THREE.MeshBasicMaterial
                    ).color.set(COLORS.NODE.SELECTED)
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
                    ).color.set(COLORS.NODE.DEFAULT)
                    forceNode.mesh.scale.set(1, 1, 1)
                }
            })

            // Set selected node appearance
            if (selectedNode) {
                ;(selectedNode.material as THREE.MeshBasicMaterial).color.set(
                    COLORS.NODE.SELECTED
                )
            }

            // If the node we're highlighting is different from the selected node, give it a distinct appearance
            if (node !== selectedNode) {
                ;(node.material as THREE.MeshBasicMaterial).color.set(
                    COLORS.NODE.SELECTED
                )
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
                    COLORS.NODE.NEIGHBOR
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
            console.log(
                `[HNSWVizPure] Auto expanding nodes to: ${targetCount} - start: ${start.userData.element}`
            )
            let totalNodes = 1
            const queue: THREE.Mesh[] = [start]
            const expanded = new Set<string>()
            let batchSize = 50 // Process nodes in batches
            let needsLayoutUpdate = false

            // Temporarily disable continuous layout updates
            forceSimulationActive.current = false

            while (queue.length > 0 && totalNodes < targetCount) {
                const current = queue.shift()!
                if (expanded.has(current.userData.element)) continue

                const response = await fetchNeighbors(current.userData.element)
                console.log("[HNSWVizPure] fetchNeighbors RESPONSE:", response)

                if (!response.success) continue

                expanded.add(current.userData.element)

                // Initialize childNodes array if it doesn't exist
                if (!current.userData.childNodes) {
                    current.userData.childNodes = []
                }

                let count = 0
                const nodesToProcess = response.result.slice(
                    0,
                    Math.min(response.result.length, targetCount - totalNodes)
                )

                // Batch create nodes without immediate layout updates
                for (const [element, similarity, vector] of nodesToProcess) {
                    console.log(
                        `[HNSWVizPure] Processing node: ${element}, similarity: ${similarity}, vector: ${vector.length}`
                    )
                    if (!element || !vector) continue

                    const angle = Math.random() * Math.PI * 2
                    const radius = 1 + Math.random() * 2
                    const x = current.position.x + Math.cos(angle) * radius
                    const y = current.position.y + Math.sin(angle) * radius

                    const neighbor = createNode(element, x, y, current, vector)

                    if (neighbor) {
                        neighbor.userData.similarity = similarity
                        createEdge(current, neighbor, similarity, true)
                        queue.push(neighbor)
                        totalNodes++
                        count++
                        needsLayoutUpdate = true
                    }

                    // Apply intermediate layout updates for better visual feedback
                    if (totalNodes % batchSize === 0) {
                        // Only update camera and do a quick force iteration
                        if (scene && camera && renderer) {
                            fitCameraToNodes()
                            renderer.render(scene, camera)
                        }
                    }
                }

                current.userData.expanded = true
                current.userData.displayState = "expanded"
                current.userData.neighborCount = count
            }

            // Re-enable layout updates
            forceSimulationActive.current = true

            // Apply final layout
            if (needsLayoutUpdate) {
                if (currentLayout === "force") {
                    // For force layout, do a few iterations to get a decent initial position
                    const iterations = 50
                    for (let i = 0; i < iterations; i++) {
                        nodesRef.current.forEach((node) => {
                            // Reset forces
                            node.force.set(0, 0)
                            node.velocity.multiplyScalar(0.9)

                            // Apply repulsive forces
                            nodesRef.current.forEach((otherNode) => {
                                if (node !== otherNode) {
                                    const dx =
                                        otherNode.mesh.position.x -
                                        node.mesh.position.x
                                    const dy =
                                        otherNode.mesh.position.y -
                                        node.mesh.position.y
                                    const distSq = dx * dx + dy * dy || 0.001
                                    const dist = Math.sqrt(distSq)
                                    const force = 1.0 / distSq
                                    node.force.x -= (dx / dist) * force
                                    node.force.y -= (dy / dist) * force
                                }
                            })
                        })

                        // Apply spring forces and update positions
                        edgesRef.current.forEach((edge) => {
                            const dx =
                                edge.target.mesh.position.x -
                                edge.source.mesh.position.x
                            const dy =
                                edge.target.mesh.position.y -
                                edge.source.mesh.position.y
                            const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
                            const force = (dist - 3.0) * 0.1
                            const fx = (dx / dist) * force
                            const fy = (dy / dist) * force

                            edge.source.mesh.position.x += fx * 0.1
                            edge.source.mesh.position.y += fy * 0.1
                            edge.target.mesh.position.x -= fx * 0.1
                            edge.target.mesh.position.y -= fy * 0.1
                        })

                        // Update edge geometries
                        if (i === iterations - 1) {
                            edgesRef.current.forEach((edge) => {
                                const points = [
                                    edge.source.mesh.position.clone(),
                                    edge.target.mesh.position.clone(),
                                ]
                                const geometry =
                                    new THREE.BufferGeometry().setFromPoints(
                                        points
                                    )
                                edge.line.geometry.dispose()
                                edge.line.geometry = geometry
                            })
                        }
                    }
                } else {
                    // For other layouts, apply once at the end
                    applyLayout(currentLayout)
                }
            }

            // Make sure the start node is selected after expansion
            setSelectedNode(start)

            // Final camera fit and render
            fitCameraToNodes()
            if (scene && camera && renderer) {
                renderer.render(scene, camera)
            }

            return Promise.resolve()
        },
        [
            createNode,
            createEdge,
            fetchNeighbors,
            setSelectedNode,
            scene,
            camera,
            renderer,
            fitCameraToNodes,
            currentLayout,
            applyLayout,
            nodesRef,
            edgesRef,
        ]
    )

    // Expand a node (show its neighbors)
    const expandNode = useCallback(
        async (node: THREE.Mesh, skipLayoutReapplication: boolean) => {
            const originalPosition = node.position.clone()
            
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

                            // Find and make edges visible (respecting the showLines setting)
                            edgesRef.current.forEach((edge) => {
                                if (
                                    (edge.source.mesh === node &&
                                        edge.target.mesh === childNode) ||
                                    (edge.source.mesh === childNode &&
                                        edge.target.mesh === node)
                                ) {
                                    // Only make the edge visible if showLines is true
                                    edge.line.visible = showLines
                                }
                            })
                        }
                    )
                }

                // Reapply current layout if not using force-directed and not skipping layout reapplication
                if (currentLayout !== "force" && !skipLayoutReapplication) {
                    const forceNode = nodesRef.current.find(
                        (n) => n.mesh === node
                    )
                    if (forceNode) {
                        setTimeout(
                            () => {
                                applyLayout(currentLayout, forceNode);
                                // Restore the original position after layout is applied
                                node.position.copy(originalPosition);
                                // Update edge geometries connected to this node
                                updateEdgeGeometries(node);
                            },
                            100
                        )
                    }
                }

                return
            }

            // If we haven't fetched neighbors yet, get them
            if (!node.userData.expanded) {
                const response = await fetchNeighbors(node.userData.element)
                if (!response.success) return
                let count = 0
                for (const [neighborElement, similarity, vector] of response.result) {
                    if (count >= maxNodes) break
                    
                    // Check if this element already exists in any node
                    const elementAlreadyExists = nodesRef.current.some(
                        existingNode => existingNode.mesh.userData.element === neighborElement
                    );
                    
                    // Skip this neighbor if it already exists
                    if (elementAlreadyExists) {
                        console.log(`Skipping duplicate node: ${neighborElement}`);
                        continue;
                    }
                    
                    const angle = Math.random() * Math.PI * 2
                    const radius = 1 + Math.random() * 2
                    const x = node.position.x + Math.cos(angle) * radius
                    const y = node.position.y + Math.sin(angle) * radius
                    const neighbor = createNode(
                        neighborElement,
                        x,
                        y,
                        node,
                        vector
                    )
                    if (neighbor) {
                        neighbor.userData.similarity = similarity
                        createEdge(node, neighbor, similarity, true)
                        count++
                    }
                }
                node.userData.expanded = true
                node.userData.displayState = "expanded"
                node.userData.neighborCount = count

                // Reapply current layout if not using force-directed and not skipping layout reapplication
                if (currentLayout !== "force" && !skipLayoutReapplication) {
                    const forceNode = nodesRef.current.find(
                        (n) => n.mesh === node
                    )
                    if (forceNode) {
                        setTimeout(
                            () => {
                                applyLayout(currentLayout, forceNode);
                                // Restore the original position after layout is applied
                                node.position.copy(originalPosition);
                                // Update edge geometries connected to this node
                                updateEdgeGeometries(node);
                            },
                            100
                        )
                    }
                }
            }
        },
        [
            createNode,
            createEdge,
            fetchNeighbors,
            maxNodes,
            edgesRef,
            nodesRef,
            currentLayout,
            applyLayout,
            setSelectedNode,
            showLines,
        ]
    )

    // Helper function to update edge geometries for a specific node
    const updateEdgeGeometries = useCallback((node: THREE.Mesh) => {
        edgesRef.current.forEach((edge) => {
            if (edge.source.mesh === node || edge.target.mesh === node) {
                const points = [
                    edge.source.mesh.position.clone(),
                    edge.target.mesh.position.clone(),
                ]
                const geometry = new THREE.BufferGeometry().setFromPoints(points)
                edge.line.geometry.dispose()
                edge.line.geometry = geometry
            }
        })
    }, [edgesRef])

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

            // If node is not expanded or was explicitly marked for expansion (via double click)
            if (
                !mesh.userData.expanded ||
                mesh.userData.displayState === "expanded"
            ) {
                // Check if we should skip layout reapplication based on current layout
                const skipLayoutReapplication = currentLayout === "pca" || currentLayout === "umap";
                expandNode(mesh, skipLayoutReapplication)
            }
        },
        [expandNode, _hoveredNode, highlightNeighbors, currentLayout]
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

                // Get position coordinates with 2 decimal places
                const posX = mesh.position.x.toFixed(2)
                const posY = mesh.position.y.toFixed(2)

                // Add similarity if available
                let labelText = truncatedText

                // Add similarity if available
                if (mesh.userData.similarity !== null && mesh.userData.similarity !== undefined) {
                    labelText += `\n - Similarity: ${mesh.userData.similarity.toFixed(4)}`
                }

                setHoverLabel({
                    visible: true,
                    text: labelText,
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
                console.log(
                    `[HNSWVizPure] Auto expanding nodes to: ${initialNodes} - start: ${initial.userData.element}`
                )
                autoExpandNodes(initial, initialNodes).then(() => {
                    // Apply PCA layout after auto-expanding only if we're not in PCA or UMAP mode
                    // This allows the initial layout to be preserved when adding more nodes
                    const rootNode = nodesRef.current.find(
                        (n) => n.mesh === initial
                    )
                    if (rootNode) {
                        setTimeout(() => applyLayout("pca", rootNode), 200)
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
        applyLayout,
        nodesRef,
        setSelectedNode,
    ])

    // Copy vector to clipboard
    const copyVectorToClipboard = useCallback(async () => {
        if (!selectedNode) return

        try {
            if (selectedNode.userData.vector) {
                const vectorString = JSON.stringify(
                    selectedNode.userData.vector
                )
                await navigator.clipboard.writeText(vectorString)
                toast.success("Vector copied to clipboard")
            } else {
                toast.error("Failed to get vector")
            }
        } catch (error) {
            console.error("Error copying vector to clipboard:", error)
            toast.error("Error copying vector to clipboard")
        }
    }, [selectedNode])

    // Toggle line visibility with storage
    const toggleLineVisibility = useCallback(
        (visible: boolean) => {
            setShowLines(visible)
            if (typeof window !== "undefined") {
                localStorage.setItem("hnswVizShowLines", visible.toString())
            }

            // Update all edge lines visibility
            edgesRef.current.forEach((edge) => {
                edge.line.visible = visible
            })

            // Force a re-render
            if (scene && camera && renderer) {
                renderer.render(scene, camera)
            }
        },
        [edgesRef, scene, camera, renderer]
    )

    // Update line visibility when showLines state changes
    useEffect(() => {
        toggleLineVisibility(showLines)
    }, [showLines, toggleLineVisibility])

    // Reset the visualization to just the initial element
    const resetVisualization = useCallback(() => {
        if (!scene) return

        // Store current settings before reset
        const currentShowLines = showLines
        const currentLayoutType = currentLayout

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
            ;(node.mesh.material as THREE.MeshBasicMaterial).color.set(
                COLORS.NODE.DEFAULT
            )
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
                // Apply the stored layout after auto-expanding
                if (currentLayoutType !== "force") {
                    const rootNode = nodesRef.current.find(
                        (n) => n.mesh === initial
                    )
                    if (rootNode) {
                        setTimeout(
                            () => applyLayout(currentLayoutType, rootNode),
                            200
                        )
                    }
                }
            })
        }

        // Restore line visibility setting
        toggleLineVisibility(currentShowLines)

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
        showLines,
        applyLayout,
        toggleLineVisibility,
        setHoveredNode,
        setHoverLabel,
    ])

    // Add a zoom control function
    const handleZoom = useCallback((zoomIn: boolean) => {
        if (!camera) return;
        
        // Adjust zoom factor
        const zoomFactor = zoomIn ? 0.8 : 1.25;
        
        // Apply zoom by scaling the camera
        camera.zoom *= zoomFactor;
        camera.updateProjectionMatrix();
        
        // Render the scene with the new camera settings
        if (renderer && scene) {
            renderer.render(scene, camera);
        }
    }, [camera, renderer, scene]);

    return (
        <div className="relative w-full h-full">
            {errorMessage && (
                <div className="error-message">{errorMessage}</div>
            )}
            <canvas ref={canvasRef} className="hnsw-viz-canvas" />
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
            {/* Loading indicator for projections */}
            {isProjectionRunning && (
                <div className="projection-loading">
                    <div className="spinner"></div>
                    <div className="loading-text">Running projection...</div>
                </div>
            )}
            <div
                className="node-info-card"
                onMouseEnter={handleCardMouseEnter}
                onMouseLeave={handleCardMouseLeave}
            >
                <Card>
                    {selectedNode && (
                        <div>
                            <CardHeader className="py-2">
                                <div className="flex justify-between items-center">
                                    <div className="flex space-x-2 items-center">
                                        {/* <div className="rounded-full bg-red-500 w-4 h-4"></div> */}
                                        <h3 className="text-lg font-semibold">
                                            Control Panel
                                        </h3>
                                    </div>
                                    <Button
                                        variant={
                                            isCardPinned ? "default" : "ghost"
                                        }
                                        size="icon"
                                        onClick={togglePin}
                                        className="h-8 w-8"
                                    >
                                        {isCardPinned ? (
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <line
                                                    x1="12"
                                                    y1="17"
                                                    x2="12"
                                                    y2="22"
                                                />
                                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                            </svg>
                                        ) : (
                                            <svg
                                                xmlns="http://www.w3.org/2000/svg"
                                                width="16"
                                                height="16"
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke="currentColor"
                                                strokeWidth="2"
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <line
                                                    x1="12"
                                                    y1="17"
                                                    x2="12"
                                                    y2="22"
                                                />
                                                <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z" />
                                            </svg>
                                        )}
                                    </Button>
                                </div>
                            </CardHeader>
                            {!isCardCollapsed && (
                                <CardContent>
                                    <div className="grid gap-2">
                                        <div className="">
                                            <span className="text-sm text-muted-foreground">
                                                Selected:
                                            </span>
                                            <span className="pl-1">
                                                {selectedNode.userData.element}
                                            </span>
                                        </div>

                                        {selectedNode.userData.similarity !==
                                            null && (
                                            <div className="">
                                                <span className="text-sm text-muted-foreground">
                                                    Similarity
                                                </span>
                                                <span className="pl-1">
                                                    {selectedNode.userData.similarity.toFixed(
                                                        4
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        <div className="">
                                            <span className="text-sm text-muted-foreground">
                                                Neighbors:
                                            </span>
                                            <span className="pl-1">
                                                {
                                                    selectedNode.userData
                                                        .neighborCount
                                                }
                                            </span>
                                        </div>

                                        <div className="flex gap-2 mt-2 w-full">
                                            {!selectedNode.userData
                                                .expanded && (
                                                <Button
                                                    onClick={() =>
                                                        expandNode(
                                                            selectedNode,
                                                            currentLayout ===
                                                                "pca" ||
                                                                currentLayout ===
                                                                    "umap"
                                                        )
                                                    }
                                                    className="w-full"
                                                    variant="outline"
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
                                                        className="w-full"
                                                        variant="outline"
                                                    >
                                                        Hide Neighbors
                                                    </Button>
                                                )}

                                            {selectedNode.userData.expanded &&
                                                selectedNode.userData
                                                    .displayState ===
                                                    "collapsed" && (
                                                    <Button
                                                        onClick={() =>
                                                            expandNode(
                                                                selectedNode,
                                                                true
                                                            )
                                                        }
                                                        className="w-full"
                                                        variant="outline"
                                                    >
                                                        Show Neighbors
                                                    </Button>
                                                )}

                                            <Button
                                                onClick={copyVectorToClipboard}
                                                className="w-full"
                                                variant="outline"
                                            >
                                                Copy Vector
                                            </Button>

                                        </div>
                                    </div>
                                </CardContent>
                            )}
                        </div>
                    )}
                    {!isCardCollapsed && (
                        <div className="space-y-4 px-4 pb-4">
                            {/* <div className="space-y-2">
                                <Label htmlFor="layout-select">
                                    Layout Algorithm
                                </Label>
                                <Select
                                    value={currentLayout}
                                    onValueChange={(
                                        value: LayoutAlgorithmType
                                    ) => {
                                        applyLayout(
                                            value,
                                            selectedNode
                                                ? nodesRef.current.find(
                                                      (n) =>
                                                          n.mesh ===
                                                          selectedNode
                                                  ) || undefined
                                                : undefined
                                        )
                                    }}
                                >
                                    <SelectTrigger id="layout-select">
                                        <SelectValue placeholder="Select layout" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="force">
                                            Force-Directed
                                        </SelectItem>
                                        <SelectItem value="umap">
                                            UMAP
                                        </SelectItem>
                                        <SelectItem value="pca">PCA</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div> */}

                            {selectedNode && currentLayout === "umap" && (
                                <Button
                                    onClick={() => {
                                        const rootNode = nodesRef.current.find(
                                            (n) => n.mesh === selectedNode
                                        )
                                        if (rootNode) {
                                            applyLayout(currentLayout, rootNode)
                                            // toast.success(
                                            //     `Applied ${layouts[currentLayout].name} layout with selected node as root`
                                            // )
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

                            <div className="flex items-center justify-between">
                                <Label
                                    htmlFor="show-lines"
                                    className="cursor-pointer"
                                >
                                    Show Relationship Lines
                                </Label>
                                <Switch
                                    id="show-lines"
                                    checked={showLines}
                                    onCheckedChange={toggleLineVisibility}
                                />
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="dark-mode">Dark Mode</Label>
                                    <Switch
                                        id="dark-mode"
                                        checked={isDarkMode}
                                        onCheckedChange={setIsDarkMode}
                                    />
                                </div>
                            </div>
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
                    )}
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
                html,
                body,
                #__next,
                main {
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
                    top: 0px;
                    right: 0px;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    z-index: 10;
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
                .projection-loading {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 100;
                }
                .spinner {
                    border: 4px solid rgba(255, 255, 255, 0.3);
                    border-top: 4px solid white;
                    border-radius: 50%;
                    width: 40px;
                    height: 40px;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% {
                        transform: rotate(0deg);
                    }
                    100% {
                        transform: rotate(360deg);
                    }
                }
                .loading-text {
                    color: white;
                    font-size: 18px;
                    margin-top: 20px;
                }
            `}</style>

            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex flex-col items-center bg-black/20 backdrop-blur-sm rounded-lg p-2 z-10">
                <button
                    onClick={() => handleZoom(false)}
                    className="p-1 hover:bg-black/30 rounded-md mb-1"
                    aria-label="Zoom in"
                >
                    <ZoomIn className="w-5 h-5 text-white" />
                </button>
                <button
                    onClick={() => handleZoom(true)}
                    className="p-1 hover:bg-black/30 rounded-md"
                    aria-label="Zoom out"
                >
                    <ZoomOut className="w-5 h-5 text-white" />
                </button>
            </div>
        </div>
    )
}

export default HNSWVizPure
