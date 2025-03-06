import * as THREE from "three"
import React, { useEffect, useRef, useState, useCallback } from "react"
import { ForceNode, ForceEdge, type SimilarityItem } from "./vizualizer/types"

// Constants
const COLORS = {
    BACKGROUND: 0xffffff,
    NODE: {
        DEFAULT: 0x3498db,
        SELECTED: 0xe74c3c,
        HOVER_HIGHLIGHT: 0x2ecc71,
    },
    EDGE: {
        DEFAULT: 0x95a5a6,
    },
}

// Three.js Scene Manager Hook
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
        scene.background = new THREE.Color(COLORS.BACKGROUND)

        // Set up camera (using orthographic projection)
        const parentWidth = canvasRef.current.parentElement?.clientWidth || window.innerWidth
        const parentHeight = canvasRef.current.parentElement?.clientHeight || window.innerHeight
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
            if (Math.abs(frustumSizeRef.current - targetFrustumSizeRef.current) > 0.01) {
                // Smooth interpolation (easing)
                frustumSizeRef.current += (targetFrustumSizeRef.current - frustumSizeRef.current) * 0.1

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
        const nodes = scene.children.filter((obj) => obj.userData && obj.userData.isNode)

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

        // Add padding
        const padding = 0.7

        // Calculate new frustum size
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

    const setManualZoom = useCallback((level: number) => {
        setZoomLevel(level)

        // Apply zoom immediately
        if (camera) {
            const newSize = 20 / level // Base frustum size divided by zoom level
            targetFrustumSizeRef.current = newSize

            if (canvasRef.current && canvasRef.current.parentElement) {
                const width = canvasRef.current.parentElement.clientWidth
                const height = canvasRef.current.parentElement.clientHeight
                const aspect = width / height

                camera.left = (-newSize * aspect) / 2
                camera.right = (newSize * aspect) / 2
                camera.top = newSize / 2
                camera.bottom = -newSize / 2
                camera.updateProjectionMatrix()
            }
        }
    }, [camera])

    return {
        canvasRef,
        scene,
        camera,
        renderer,
        fitCameraToNodes,
        _zoomLevel: zoomLevel,
        _setManualZoom: setManualZoom,
        _isAutoZoom: isAutoZoom,
        _toggleAutoZoom: () => setIsAutoZoom(prev => !prev),
        resetView: useCallback(() => {
            setZoomLevel(1)
            setIsAutoZoom(true)
            isInitialZoomRef.current = true
            fitCameraToNodes()
        }, [fitCameraToNodes]),
    }
}

// Force Simulation Hook
function useForceSimulator(scene: THREE.Scene | null, fitCameraToNodes: () => void) {
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
            vector: mesh.userData.vector,
        }
        nodesRef.current.push(node)
        return node
    }, [])

    const addEdge = useCallback((source: ForceNode, target: ForceNode, strength: number, line: THREE.Line) => {
        const edge: ForceEdge = { source, target, line, strength }
        edgesRef.current.push(edge)
        return edge
    }, [])

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
                const dx = edge.target.mesh.position.x - edge.source.mesh.position.x
                const dy = edge.target.mesh.position.y - edge.source.mesh.position.y
                const dist = Math.sqrt(dx * dx + dy * dy) || 0.001
                const force = (dist - SPRING_LENGTH) * SPRING_COEFFICIENT * edge.strength
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

            // Update edge geometries
            edgesRef.current.forEach((edge) => {
                const points = [edge.source.mesh.position.clone(), edge.target.mesh.position.clone()]
                const geometry = new THREE.BufferGeometry().setFromPoints(points)
                edge.line.geometry.dispose()
                edge.line.geometry = geometry
            })
        }

        // Adjust camera to fit all nodes after forces are applied
        fitCameraToNodes()
    }, [ITERATIONS_PER_FRAME, REPULSION, SPRING_LENGTH, SPRING_COEFFICIENT, TIMESTEP, fitCameraToNodes])

    const startSimulation = useCallback((
        scene: THREE.Scene | null,
        camera: THREE.OrthographicCamera | null,
        renderer: THREE.WebGLRenderer | null,
        isForceActive: React.MutableRefObject<boolean>
    ) => {
        const animate = () => {
            if (isForceActive.current) {
                simulateForces()
            }

            if (scene && camera && renderer) {
                renderer.render(scene, camera)
            }
            animationFrameId.current = requestAnimationFrame(animate)
        }
        animate()
    }, [simulateForces])

    useEffect(() => {
        return () => {
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current)
            }
        }
    }, [])

    return { nodesRef, edgesRef, addNode, addEdge, startSimulation }
}

type VizMode = "NeighborExpansion" | "SimilarityArray"

interface VectorViz2DProps {
    mode: VizMode
    keyName: string
    // For NeighborExpansion mode
    initialElement?: string
    // For SimilarityArray mode
    initialItems?: SimilarityItem[]
    maxNodes?: number
    initialNodes?: number
    // Generic callback for both modes
    onExpandNode: (
        keyName: string,
        element: string,
        mode: VizMode,
        count: number
    ) => Promise<SimilarityItem[]>
}

const VectorViz2D: React.FC<VectorViz2DProps> = ({
    mode,
    keyName,
    initialElement,
    initialItems,
    maxNodes = 100,
    initialNodes = 20,
    onExpandNode,
}) => {
    // Get all the zoom-related values from useThreeScene
    const { 
        scene, 
        camera, 
        renderer, 
        canvasRef, 
        fitCameraToNodes,
        _zoomLevel: zoomLevel,
        _setManualZoom: setManualZoom,
        _isAutoZoom: isAutoZoom,
        _toggleAutoZoom: toggleAutoZoom,
        resetView,
    } = useThreeScene()

    const nodesRef = useRef<ForceNode[]>([])
    const edgesRef = useRef<ForceEdge[]>([])
    const [selectedNode, setSelectedNode] = useState<THREE.Mesh | null>(null)
    const [hoveredNode, setHoveredNode] = useState<THREE.Mesh | null>(null)
    const renderedElements = useRef<Set<string>>(new Set())
    const isForceActive = useRef<boolean>(true)

    // Use force simulator for node management
    const { addNode, addEdge, startSimulation } = useForceSimulator(scene, fitCameraToNodes)

    const updateNodePositions = useCallback(() => {
        startSimulation(scene, camera, renderer, isForceActive)
    }, [scene, camera, renderer, startSimulation])

    // Create and add a node to the scene
    const createNode = useCallback(
        (element: string, x: number, y: number, parentNode?: THREE.Mesh, vector?: number[]): THREE.Mesh | null => {
            if (renderedElements.current.has(element) || !scene) return null

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
                vector: vector,
            }
            scene.add(circle)
            const node = addNode(circle)
            node.vector = vector
            renderedElements.current.add(element)

            // Add this node as a child to its parent
            if (parentNode) {
                if (!parentNode.userData.childNodes) {
                    parentNode.userData.childNodes = []
                }
                parentNode.userData.childNodes.push(circle)
            }

            // Only fit camera on initial nodes
            if (renderedElements.current.size < 5) {
                setTimeout(() => fitCameraToNodes(), 0)
            }

            return circle
        },
        [scene, addNode, fitCameraToNodes]
    )

    // Create and add an edge between nodes
    const createEdge = useCallback(
        (source: THREE.Mesh, target: THREE.Mesh, similarity: number): THREE.Line | null => {
            if (!scene) return null
            const points = [source.position.clone(), target.position.clone()]
            const geometry = new THREE.BufferGeometry().setFromPoints(points)
            const material = new THREE.LineBasicMaterial({
                color: COLORS.EDGE.DEFAULT,
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
            }
            return line
        },
        [scene, nodesRef, addEdge]
    )

    // Initialize visualization based on mode
    useEffect(() => {
        const initializeViz = async () => {
            if (mode === "NeighborExpansion" && initialElement) {
                const results = await onExpandNode(keyName, initialElement, mode, initialNodes)
                // Handle neighbor expansion initialization
                const initialNode = createNode(initialElement, 0, 0, undefined, results[0]?.vector)
                if (initialNode) {
                    results.forEach((item) => {
                        const neighbor = createNode(item.element, Math.random() * 5, Math.random() * 5, initialNode, item.vector)
                        if (neighbor) {
                            createEdge(initialNode, neighbor, item.similarity)
                        }
                    })
                }
            } else if (mode === "SimilarityArray" && initialItems) {
                initialItems.forEach((item) => {
                    console.log("[VectorViz2D] Initializing similarity array:", item)
                    createNode(item.element, Math.random() * 10 - 5, Math.random() * 10 - 5, undefined, item.vector)
                })
            }
            updateNodePositions()
        }

        initializeViz()
    }, [mode, initialElement, initialItems, createNode, createEdge, updateNodePositions, keyName, initialNodes, onExpandNode])

    // Handle node expansion
    const handleNodeClick = useCallback(
        async (node: THREE.Mesh) => {
            if (!node.userData.element) return

            const count = mode === "NeighborExpansion" ? initialNodes : maxNodes
            const results = await onExpandNode(keyName, node.userData.element, mode, count)

            if (mode === "SimilarityArray") {
                // Clear existing nodes and create new ones
                nodesRef.current.forEach((node) => scene?.remove(node.mesh))
                edgesRef.current.forEach((edge) => scene?.remove(edge.line))
                nodesRef.current = []
                edgesRef.current = []
                renderedElements.current.clear()
            }

            results.forEach((item) => {
                const neighbor = createNode(item.element, node.position.x + Math.random() * 2 - 1, node.position.y + Math.random() * 2 - 1, node, item.vector)
                if (neighbor && mode === "NeighborExpansion") {
                    createEdge(node, neighbor, item.similarity)
                }
            })

            updateNodePositions()
        },
        [mode, scene, createNode, createEdge, updateNodePositions, keyName, initialNodes, maxNodes, onExpandNode]
    )

    // Handle wheel zoom
    const handleWheel = useCallback(
        (e: WheelEvent) => {
            e.preventDefault()
            if (!camera || !canvasRef.current) return

            // Disable auto zoom when manually zooming
            if (isAutoZoom) {
                toggleAutoZoom()
            }

            // Get mouse position in normalized device coordinates (-1 to +1)
            const rect = canvasRef.current.getBoundingClientRect()
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1

            // Calculate world position before zoom
            const worldPosBeforeZoom = new THREE.Vector3(mouseX, mouseY, 0)
            worldPosBeforeZoom.unproject(camera)

            // Calculate new zoom level
            const zoomSpeed = 0.1
            const delta = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed
            const newZoom = Math.max(0.1, Math.min(5, zoomLevel * delta))
            setManualZoom(newZoom)

            // Calculate world position after zoom
            const worldPosAfterZoom = new THREE.Vector3(mouseX, mouseY, 0)
            worldPosAfterZoom.unproject(camera)

            // Adjust camera position to keep mouse position fixed
            camera.position.x += worldPosBeforeZoom.x - worldPosAfterZoom.x
            camera.position.y += worldPosBeforeZoom.y - worldPosAfterZoom.y

            // Render the scene
            if (renderer && scene) {
                renderer.render(scene, camera)
            }
        },
        [camera, renderer, scene, zoomLevel, isAutoZoom, toggleAutoZoom, setManualZoom, canvasRef]
    )

    // Add wheel event listener
    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        canvas.addEventListener('wheel', handleWheel, { passive: false })
        return () => {
            canvas.removeEventListener('wheel', handleWheel)
        }
    }, [canvasRef, handleWheel])

    return (
        <div className="relative w-full h-full">
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                onClick={(e) => {
                    const rect = canvasRef.current?.getBoundingClientRect()
                    if (!rect || !camera || !scene) return

                    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
                    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1

                    const raycaster = new THREE.Raycaster()
                    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)

                    const intersects = raycaster.intersectObjects(scene.children)
                    const clickedNode = intersects.find((i) => i.object.userData?.isNode)?.object as THREE.Mesh

                    if (clickedNode) {
                        handleNodeClick(clickedNode)
                    }
                }}
            />
            {/* Zoom controls */}
            <div className="absolute bottom-4 right-4 flex flex-col gap-2">
                <div className="flex items-center gap-2 text-sm">
                    <label className="text-gray-600">Auto-zoom</label>
                    <button
                        className={`px-2 py-1 rounded ${
                            isAutoZoom 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-200 text-gray-700'
                        }`}
                        onClick={toggleAutoZoom}
                    >
                        {isAutoZoom ? 'On' : 'Off'}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button
                        className="bg-white hover:bg-gray-100 p-2 rounded shadow text-gray-700"
                        onClick={() => {
                            const newZoom = Math.min(5, zoomLevel * 1.2)
                            setManualZoom(newZoom)
                        }}
                    >
                        <span className="text-lg">+</span>
                    </button>
                    <button
                        className="bg-white hover:bg-gray-100 p-2 rounded shadow text-gray-700"
                        onClick={() => {
                            const newZoom = Math.max(0.1, zoomLevel / 1.2)
                            setManualZoom(newZoom)
                        }}
                    >
                        <span className="text-lg">−</span>
                    </button>
                    <button
                        className="bg-white hover:bg-gray-100 px-3 py-2 rounded shadow text-sm text-gray-700"
                        onClick={resetView}
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    )
}

export default VectorViz2D
