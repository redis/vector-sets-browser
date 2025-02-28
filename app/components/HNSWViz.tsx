import React, { useRef, useState, useEffect, useCallback } from "react"
import * as THREE from "three"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
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
                const currentSize = frustumSizeRef.current
                const newSize = 20 / level
                targetFrustumSizeRef.current = newSize

                // If auto zoom is off, we need to manually update the target frustum size
                if (!isAutoZoom) {
                    // Keep the current center point when zooming
                    const aspect = canvasRef.current?.parentElement?.clientWidth
                        ? canvasRef.current.parentElement.clientWidth /
                          canvasRef.current.parentElement.clientHeight
                        : 1

                    const centerX = camera.position.x
                    const centerY = camera.position.y

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
        zoomLevel,
        setManualZoom,
        isAutoZoom,
        toggleAutoZoom,
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
            renderer: THREE.WebGLRenderer | null
        ) => {
            const animate = () => {
                simulateForces()
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
                setErrorMessage("Error fetching neighbors")
                return { success: false, result: [] }
            }
        },
        [keyName, maxNodes]
    )

    return { errorMessage, getNeighbors }
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
    updateHoverLabel: (mesh: THREE.Mesh | null) => void
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
                    // Update hover label
                    updateHoverLabel(hoveredNodeRef.current)
                }
            } else if (hoveredNodeRef.current) {
                // No longer hovering over any node
                hoveredNodeRef.current = null
                onNodeHover(null)
                updateHoverLabel(null)
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
        zoomLevel,
        setManualZoom,
        isAutoZoom,
        toggleAutoZoom,
        resetView,
    } = useThreeScene()
    const { errorMessage, getNeighbors } = useNodeManager(keyName, maxNodes)
    const { nodesRef, edgesRef, addNode, addEdge, startSimulation } =
        useForceSimulator(scene, fitCameraToNodes)
    const [selectedNode, setSelectedNode] = useState<THREE.Mesh | null>(null)
    const [hoveredNode, setHoveredNode] = useState<THREE.Mesh | null>(null)
    const [renderedElements, setRenderedElements] = useState<Set<string>>(
        new Set()
    )

    // State for reset confirmation dialog
    const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)

    // References for hover and selection effects
    const hoverHighlightRef = useRef<THREE.Mesh | null>(null)
    const hoverLabelRef = useRef<THREE.Sprite | null>(null)
    const pulseAnimationRef = useRef<number>(0)
    const pulseDirectionRef = useRef<number>(1)
    const pulseScaleRef = useRef<number>(1)

    // State for HTML hover label
    const [hoverLabel, setHoverLabel] = useState<{
        visible: boolean
        text: string
    }>({
        visible: false,
        text: "",
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

    // Create text sprite for node labels
    const createTextSprite = useCallback((text: string): THREE.Sprite => {
        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")
        if (!context) throw new Error("Could not get canvas context")

        canvas.width = 256
        canvas.height = 64

        context.fillStyle = "rgba(255, 255, 255, 0.9)"
        context.fillRect(0, 0, canvas.width, canvas.height)

        context.font = "24px Arial"
        context.fillStyle = "black"
        context.textAlign = "center"
        context.textBaseline = "middle"
        context.fillText(text, canvas.width / 2, canvas.height / 2)

        const texture = new THREE.CanvasTexture(canvas)
        const material = new THREE.SpriteMaterial({ map: texture })
        const sprite = new THREE.Sprite(material)
        sprite.scale.set(2, 0.5, 1)

        return sprite
    }, [])

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
            }
        },
        [scene]
    )

    // Update selected node appearance
    useEffect(() => {
        // Reset all nodes to default appearance
        nodesRef.current.forEach((node) => {
            if (node.mesh !== selectedNode) {
                ;(node.mesh.material as THREE.MeshBasicMaterial).color.set(
                    0x4a90e2
                )
                node.mesh.scale.set(1, 1, 1)
            }
        })

        // Set selected node appearance
        if (selectedNode) {
            ;(selectedNode.material as THREE.MeshBasicMaterial).color.set(
                0xff0000
            )

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
    }, [selectedNode, nodesRef])

    // Automatically expand nodes until a target count is reached
    const autoExpandNodes = useCallback(
        async (start: THREE.Mesh, targetCount: number) => {
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
        },
        [createNode, createEdge, getNeighbors]
    )

    // Expand a node when clicked
    const expandNode = useCallback(
        async (node: THREE.Mesh) => {
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
            }
        },
        [createNode, createEdge, getNeighbors, maxNodes, edgesRef]
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
        [expandNode]
    )

    // Hook up canvas events
    useCanvasEvents(
        canvasRef,
        camera,
        scene,
        handleNodeClick,
        handleNodeHover,
        // Update hover label
        (mesh) => {
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
                })
            } else {
                setHoverLabel({ visible: false, text: "" })
            }
        }
    )

    // Start the simulation once the scene is ready
    useEffect(() => {
        if (scene && camera && renderer) {
            startSimulation(scene, camera, renderer)
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
                autoExpandNodes(initial, initialNodes)
            }
        }
    }, [scene, initialElement, initialNodes, createNode, autoExpandNodes])

    // Reset the visualization to just the initial element
    const resetVisualization = useCallback(() => {
        if (!scene) return

        // Clear selection and hover states
        setSelectedNode(null)
        setHoveredNode(null)
        setHoverLabel({ visible: false, text: "" })

        // Remove hover highlight if it exists
        if (hoverHighlightRef.current) {
            scene.remove(hoverHighlightRef.current)
            hoverHighlightRef.current = null
        }

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
            autoExpandNodes(initial, initialNodes)
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
    ])

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {errorMessage && (
                <div className="error-message">{errorMessage}</div>
            )}
            <canvas
                ref={canvasRef}
                style={{ display: "block", width: "100%", height: "100%" }}
            />
            {hoverLabel.visible && (
                <div className="hover-label">{hoverLabel.text}</div>
            )}
            {selectedNode && (
                <div className="node-info-card">
                    <Card>
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

                                {selectedNode.userData.similarity !== null && (
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
                                        {selectedNode.userData.neighborCount}
                                    </span>
                                </div>

                                <div className="flex flex-col">
                                    <span className="font-medium text-sm text-muted-foreground">
                                        Status
                                    </span>
                                    <span>
                                        {selectedNode.userData.expanded
                                            ? selectedNode.userData
                                                  .displayState === "expanded"
                                                ? "Expanded"
                                                : "Collapsed"
                                            : "Not Expanded"}
                                    </span>
                                </div>

                                <div className="flex flex-col">
                                    <span className="font-medium text-sm text-muted-foreground">
                                        Position
                                    </span>
                                    <span className="font-mono">
                                        x: {selectedNode.position.x.toFixed(2)},
                                        y: {selectedNode.position.y.toFixed(2)}
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
                                        selectedNode.userData.displayState ===
                                            "expanded" && (
                                            <Button
                                                onClick={() =>
                                                    collapseNode(selectedNode)
                                                }
                                                size="sm"
                                                variant="outline"
                                            >
                                                Collapse Node
                                            </Button>
                                        )}

                                    {selectedNode.userData.expanded &&
                                        selectedNode.userData.displayState ===
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
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
            <div className="controls-panel">
                <Card className="">
                    <CardContent className="pt-4">
                        <Button
                            onClick={() => setIsResetDialogOpen(true)}
                            variant="destructive"
                            size="sm"
                            className="w-full"
                        >
                            Reset Graph
                        </Button>
                    </CardContent>
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
            <style jsx>{`
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
                    width: 250px;
                }
                .hover-label {
                    position: absolute;
                    top: 20px;
                    left: 20px;
                    background-color: rgba(0, 0, 0, 0.95);
                    color: white;
                    padding: 10px 14px;
                    border-radius: 6px;
                    z-index: 20;
                    font-family: monospace;
                    font-size: 15px;
                    max-width: 400px;
                    word-break: break-all;
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                    pointer-events: none;
                    transition: opacity 0.2s ease;
                    white-space: nowrap;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                }
            `}</style>
        </div>
    )
}

export default HNSWViz
