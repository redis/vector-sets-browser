"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import * as THREE from "three"
import { toast } from "sonner"
import { MAX_LABELED_NODES } from "./constants"
import {
    useThreeScene,
    useForceSimulator,
    useLayoutManager,
    useNodeManager,
    useCanvasEvents,
    useVisualizationState,
} from "./hooks"
import { ControlPanel, ZoomControls, HoverLabel, LoadingOverlay } from "./components"
import type { HNSWVizPureProps } from "./types"

// Comment out the old implementation
/* Original implementation...
[Previous implementation goes here]
*/

// Add error message display
const ErrorMessage = ({ message }: { message: string }) => (
    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-500/80 text-white px-4 py-2 rounded-md z-50">
        {message}
    </div>
)

const HNSWVizPure: React.FC<HNSWVizPureProps> = ({
    initialElement,
    maxNodes = 100,
    initialNodes = 20,
    getNeighbors,
}) => {
    // Refs for hover and selection effects
    const hoverHighlightRef = useRef<THREE.Mesh | null>(null)
    const pulseAnimationRef = useRef<number>(0)
    const pulseDirectionRef = useRef<number>(1)
    const pulseScaleRef = useRef<number>(1)
    const selectedNodeRef = useRef<THREE.Mesh | null>(null)
    const highlightedEdgesRef = useRef<Set<THREE.Line>>(new Set())

    // State for hover label
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
    const [selectedNode, setSelectedNode] = useState<THREE.Mesh | null>(null)
    
    // Initialize visualization state
    const {
        isDarkMode,
        showLines,
        isCardPinned,
        loadColorScheme,
        saveColorScheme,
        loadLineVisibility,
        saveLineVisibility,
        loadCardPinState,
        saveCardPinState,
        toggleDarkMode,
        toggleLineVisibility,
        toggleCardPin,
    } = useVisualizationState()

    // Initialize Three.js scene and related functionality
    const {
        canvasRef,
        scene,
        camera,
        renderer,
        fitCameraToNodes,
        updateGuideLineColors,
        handleZoom: originalHandleZoom,
    } = useThreeScene()

    // Function to update label scales based on camera distance
    const updateLabelScales = useCallback(() => {
        if (!camera) return

        const frustumSize = camera.top - camera.bottom
        const baseSize = 20 // This is our reference frustum size
        const scaleFactor = frustumSize / baseSize

        nodesRef.current.forEach((node) => {
            if (node.label) {
                const baseScale = node.label.userData.baseScale
                if (baseScale) {
                    // Apply consistent scaling that grows/shrinks with zoom
                    node.label.scale.set(
                        baseScale.x * scaleFactor,
                        baseScale.y * scaleFactor,
                        1
                    )
                }
            }
        })
    }, [camera])

    // Create wrapped zoom handler
    const handleZoom = useCallback(
        (zoomIn: boolean) => {
            if (!camera) return
            const currentFrustumSize = camera.top - camera.bottom
            const newFrustumSize = zoomIn
                ? Math.max(currentFrustumSize * 0.8, 5)
                : currentFrustumSize * 1.2

            const aspect = window.innerWidth / window.innerHeight
            camera.left = (-newFrustumSize * aspect) / 2
            camera.right = (newFrustumSize * aspect) / 2
            camera.top = newFrustumSize / 2
            camera.bottom = -newFrustumSize / 2
            camera.updateProjectionMatrix()

            updateLabelScales()
            if (originalHandleZoom) {
                originalHandleZoom(zoomIn)
            }
        },
        [camera, updateLabelScales, originalHandleZoom]
    )

    // Animation loop ref
    const animationFrameRef = useRef<number>()

    // Set up animation loop
    useEffect(() => {
        const animate = () => {
            if (camera && renderer && scene) {
                // Update renderer clear color to match the canvas background
                renderer.setClearColor(isDarkMode ? 0x0d1e26 : 0xf5f5f5)

                updateLabelScales()
                renderer.render(scene, camera)
            }
            animationFrameRef.current = requestAnimationFrame(animate)
        }

        animate()

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current)
            }
        }
    }, [camera, renderer, scene, updateLabelScales, isDarkMode])

    // Initialize force simulation
    const { nodesRef, edgesRef, addNode, addEdge, startSimulation } =
        useForceSimulator(scene, fitCameraToNodes)

    // Initialize layout management
    const {
        currentLayout,
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

    // Initialize node management
    const { errorMessage, fetchNeighbors } = useNodeManager(
        maxNodes,
        getNeighbors
    )

    // Function to create a node mesh
    const createNodeMesh = (element: string, vector?: number[]) => {
        const geometry = new THREE.SphereGeometry(0.5, 32, 32)
        const material = new THREE.MeshBasicMaterial({
            color: isDarkMode ? 0xffffff : 0x1a3b4c,
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.userData = {
            isNode: true,
            element,
            vector,
            expanded: false,
            displayState: "default",
        }
        return mesh
    }

    // Function to create a label for a node
    const createLabel = (text: string, mesh: THREE.Mesh) => {
        return null

        const canvas = document.createElement("canvas")
        const context = canvas.getContext("2d")
        if (!context) return null

        // Set font size and measure text
        const fontSize = 32 // Base font size
        context.font = `${fontSize}px Arial`
        const textMetrics = context.measureText(text)
        const textHeight = fontSize
        const padding = fontSize / 2

        // Set canvas size based on text measurements
        canvas.width = textMetrics.width + padding * 2
        canvas.height = textHeight + padding * 2

        // Need to reset font after canvas resize
        context.font = `${fontSize}px Arial`
        context.textAlign = "left" // Left align the text
        context.textBaseline = "middle"
        context.fillStyle = isDarkMode ? "#ffffff" : "#000000"

        // Draw text with left padding
        context.fillText(text, padding, canvas.height / 2)

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas)
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
        })
        const sprite = new THREE.Sprite(spriteMaterial)

        // Set initial scale based on canvas dimensions
        const aspectRatio = canvas.width / canvas.height
        sprite.userData.baseScale = new THREE.Vector3(
            aspectRatio * (fontSize / 32), // Scale width by aspect ratio and relative to base font size
            1 * (fontSize / 32), // Scale height relative to base font size
            1
        )
        sprite.scale.copy(sprite.userData.baseScale)

        // Position sprite centered under the node
        sprite.position.copy(mesh.position)
        const nodeRadius = 0.5 // This matches the sphere geometry radius
        const labelOffset = 0.8 // Offset below the node
        sprite.position.y -= nodeRadius + labelOffset

        // Center the sprite horizontally
        sprite.center.set(0.5, 1) // This makes (0.5,1) the top-center point of the sprite

        return sprite
    }

    // Function to update hover label
    const updateHoverLabel = (
        mesh: THREE.Mesh | null,
        x: number,
        y: number
    ) => {
        if (!scene) return

        // Remove existing hover highlight if it exists
        if (hoverHighlightRef.current) {
            scene.remove(hoverHighlightRef.current)
            hoverHighlightRef.current = null
        }

        if (mesh && mesh.userData.isNode) {
            // Create hover highlight mesh
            const geometry = new THREE.SphereGeometry(0.6, 32, 32)
            const material = new THREE.MeshBasicMaterial({
                color: isDarkMode ? 0xd6ff18 : 0xff4438,
                transparent: true,
                opacity: 0.3,
            })
            const highlight = new THREE.Mesh(geometry, material)
            highlight.position.copy(mesh.position)
            scene.add(highlight)
            hoverHighlightRef.current = highlight

            // Update hover label text
            const elementName = mesh.userData.element
            const truncatedText =
                elementName.length > 50
                    ? elementName.substring(0, 47) + "..."
                    : elementName

            let labelText = truncatedText

            // Add similarity if available
            if (
                mesh.userData.similarity !== null &&
                mesh.userData.similarity !== undefined
            ) {
                labelText += `\n - Similarity: ${mesh.userData.similarity.toFixed(
                    4
                )}`
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

    // Function to update edge geometries for a node
    const updateEdgeGeometries = useCallback(
        (node: THREE.Mesh) => {
            edgesRef.current.forEach((edge) => {
                if (edge.source.mesh === node || edge.target.mesh === node) {
                    const points = [
                        edge.source.mesh.position,
                        edge.target.mesh.position,
                    ]
                    const geometry = new THREE.BufferGeometry().setFromPoints(
                        points
                    )
                    edge.line.geometry.dispose()
                    edge.line.geometry = geometry
                }
            })
        },
        [edgesRef]
    )

    // Handle node click
    const handleNodeClick = async (
        mesh: THREE.Mesh,
        maxNeighborCount?: number
    ) => {
        if (!scene || !mesh.userData.element) return

        // Update selected node
        selectedNodeRef.current = mesh
        setSelectedNode(mesh)

        // Start pulse animation for selected node
        const animatePulse = () => {
            if (!selectedNodeRef.current) return

            // Update pulse scale
            pulseScaleRef.current += pulseDirectionRef.current * 0.02
            if (pulseScaleRef.current > 1.2) pulseDirectionRef.current = -1
            if (pulseScaleRef.current < 1) pulseDirectionRef.current = 1

            // Apply scale to selected node
            selectedNodeRef.current.scale.setScalar(pulseScaleRef.current)

            // Update label scales after adding new nodes
            updateLabelScales()

            pulseAnimationRef.current = requestAnimationFrame(animatePulse)
        }

        // Start pulse animation
        if (pulseAnimationRef.current) {
            cancelAnimationFrame(pulseAnimationRef.current)
        }
        pulseAnimationRef.current = requestAnimationFrame(animatePulse)

        // Fetch and add neighbor nodes
        const response = await fetchNeighbors(mesh.userData.element)
        console.log("[HNSWVizPure] Response from fetchNeighbors:", response)

        if (!response.success || !scene) return

        // If maxNeighborCount is provided, we're in the initial expansion mode
        // Otherwise, we're in user-click mode and should add all immediate neighbors
        const currentNodeCount = nodesRef.current.length

        // Determine how many nodes we can add
        let remainingSlots: number

        if (maxNeighborCount !== undefined) {
            // Initial expansion mode - limit by maxNeighborCount
            remainingSlots = Math.max(0, maxNeighborCount - currentNodeCount)
            if (remainingSlots === 0) {
                return
            }
        } else {
            // User click mode - add all immediate neighbors, limited by maxNodes
            remainingSlots = Math.max(0, maxNodes - currentNodeCount)
            if (remainingSlots === 0) {
                //toast.info(`Maximum number of nodes (${maxNodes}) reached`)
                return
            }
        }

        // Process each neighbor
        let addedNodes = 0

        // In user click mode, we want all neighbors
        // In initial expansion mode, we limit by remainingSlots
        const neighborsToProcess =
            maxNeighborCount !== undefined
                ? response.result.slice(0, remainingSlots)
                : response.result

        // Keep track of the most similar neighbor for potential recursive expansion
        let mostSimilarNeighbor: {
            mesh: THREE.Mesh
            similarity: number
        } | null = null

        for (const item of neighborsToProcess) {
            // In initial expansion mode, check if we've added enough nodes
            if (maxNeighborCount !== undefined && addedNodes >= remainingSlots)
                break

            // In user click mode, check if we've hit the maxNodes limit
            if (
                maxNeighborCount === undefined &&
                nodesRef.current.length >= maxNodes
            ) {
                //toast.info(`Maximum number of nodes (${maxNodes}) reached`)
                break
            }

            // Check if this element already exists
            const existingNode = nodesRef.current.find(
                (n) => n.mesh.userData.element === item.element
            )

            if (!existingNode) {
                // Create new node
                const newMesh = createNodeMesh(item.element, item.vector)
                newMesh.userData.similarity = item.similarity
                scene.add(newMesh)
                const newNode = addNode(newMesh)

                // Create label if needed
                if (nodesRef.current.length <= MAX_LABELED_NODES) {
                    const label = createLabel(item.element, newMesh)
                    if (label) {
                        scene.add(label)
                        newNode.label = label
                    }
                }

                // Create edge
                const points = [mesh.position, newMesh.position]
                const geometry = new THREE.BufferGeometry().setFromPoints(
                    points
                )
                const material = new THREE.LineBasicMaterial({
                    color: isDarkMode ? 0xf3ffbb : 0x4a90e2,
                    transparent: true,
                    opacity: showLines ? 0.5 : 0,
                })
                const line = new THREE.Line(geometry, material)
                scene.add(line)

                // Add edge with similarity as strength
                addEdge(
                    nodesRef.current.find((n) => n.mesh === mesh)!,
                    newNode,
                    item.similarity,
                    line
                )

                addedNodes++

                // Track the most similar neighbor for potential recursive expansion
                if (
                    maxNeighborCount !== undefined &&
                    (!mostSimilarNeighbor ||
                        item.similarity > mostSimilarNeighbor.similarity)
                ) {
                    mostSimilarNeighbor = {
                        mesh: newMesh,
                        similarity: item.similarity,
                    }
                }
            }
        }

        // Apply current layout
        applyLayout(currentLayout)

        // If we're in initial expansion mode and haven't added enough nodes,
        // recursively expand the most similar neighbor
        if (
            maxNeighborCount !== undefined &&
            nodesRef.current.length < maxNeighborCount &&
            mostSimilarNeighbor
        ) {
            console.log(
                "[HNSWVizPure] Recursively expanding most similar neighbor to reach initialNodes count"
            )

            // Small delay to allow the current layout to settle
            setTimeout(() => {
                handleNodeClick(mostSimilarNeighbor!.mesh, maxNeighborCount)
            }, 100)
        }
    }

    // Handle node hover
    const handleNodeHover = (mesh: THREE.Mesh | null) => {
        if (!scene) return

        // Update hover highlight
        if (hoverHighlightRef.current) {
            scene.remove(hoverHighlightRef.current)
            hoverHighlightRef.current = null
        }

        // Reset all previously highlighted edges to default
        highlightedEdgesRef.current.forEach((line) => {
            const material = line.material as THREE.LineBasicMaterial
            material.color.set(isDarkMode ? 0xf3ffbb : 0x4a90e2)
            material.opacity = showLines ? 0.5 : 0
        })
        highlightedEdgesRef.current.clear()

        if (mesh) {
            // Create node highlight effect
            const geometry = new THREE.SphereGeometry(0.6, 32, 32)
            const material = new THREE.MeshBasicMaterial({
                color: isDarkMode ? 0xd6ff18 : 0xff4438,
                transparent: true,
                opacity: 0.3,
            })
            const highlight = new THREE.Mesh(geometry, material)
            highlight.position.copy(mesh.position)
            scene.add(highlight)
            hoverHighlightRef.current = highlight

            // Highlight edges connected to this node
            edgesRef.current.forEach((edge) => {
                if (edge.source.mesh === mesh || edge.target.mesh === mesh) {
                    const material = edge.line
                        .material as THREE.LineBasicMaterial
                    // Use a brighter color for the highlighted edges
                    material.color.set(isDarkMode ? 0xffffff : 0xff4438)
                    // Increase opacity for better visibility
                    material.opacity = 0.8
                    // Track this edge as highlighted
                    highlightedEdgesRef.current.add(edge.line)
                }
            })
        }
    }

    // Initialize canvas events
    useCanvasEvents(
        canvasRef,
        camera,
        scene,
        handleNodeClick,
        handleNodeHover,
        updateHoverLabel
    )

    // Load user preferences
    useEffect(() => {
        loadColorScheme()
        loadLineVisibility()
        loadCardPinState()
    }, [loadColorScheme, loadLineVisibility, loadCardPinState])

    // Save preferences when they change
    useEffect(() => {
        saveColorScheme()
    }, [isDarkMode, saveColorScheme])

    useEffect(() => {
        saveLineVisibility()
    }, [showLines, saveLineVisibility])

    useEffect(() => {
        saveCardPinState()
    }, [isCardPinned, saveCardPinState])

    // Start force simulation when ready
    useEffect(() => {
        if (scene && camera && renderer) {
            startSimulation(scene, camera, renderer, forceSimulationActive)
        }
    }, [scene, camera, renderer, startSimulation, forceSimulationActive])

    // Load initial data
    useEffect(() => {
        const initializeVisualization = async () => {
            if (!scene || !initialElement) return

            // Clear existing visualization first
            const cleanup = () => {
                // Clear all nodes and their labels
                nodesRef.current.forEach((node) => {
                    if (node.mesh) {
                        scene.remove(node.mesh)
                        if (node.mesh.geometry) node.mesh.geometry.dispose()
                        if (node.mesh.material) {
                            if (Array.isArray(node.mesh.material)) {
                                node.mesh.material.forEach((m) => m.dispose())
                            } else {
                                node.mesh.material.dispose()
                            }
                        }
                        if (node.label) {
                            scene.remove(node.label)
                            if (node.label.material) {
                                if (node.label.material.map)
                                    node.label.material.map.dispose()
                                node.label.material.dispose()
                            }
                        }
                    }
                })

                // Clear all edges
                edgesRef.current.forEach((edge) => {
                    if (edge.line) {
                        scene.remove(edge.line)
                        if (edge.line.geometry) edge.line.geometry.dispose()
                        if (
                            edge.line.material &&
                            !Array.isArray(edge.line.material)
                        ) {
                            edge.line.material.dispose()
                        }
                    }
                })

                // Clear hover highlight
                if (hoverHighlightRef.current) {
                    scene.remove(hoverHighlightRef.current)
                    hoverHighlightRef.current = null
                }

                // Reset refs and state
                nodesRef.current = []
                edgesRef.current = []
                highlightedEdgesRef.current.clear()
                selectedNodeRef.current = null
                setSelectedNode(null)
                pulseScaleRef.current = 1
                pulseDirectionRef.current = 1

                // Cancel any ongoing animations
                if (pulseAnimationRef.current) {
                    cancelAnimationFrame(pulseAnimationRef.current)
                    pulseAnimationRef.current = 0
                }
            }

            // Clean up existing visualization
            cleanup()

            // Creating initial node with complete similarity item data
            console.log(
                "[HNSWVizPure] Creating initial mesh with element: ",
                initialElement
            )
            const initialMesh = createNodeMesh(
                initialElement.element,
                initialElement.vector
            )
            initialMesh.userData.similarity = initialElement.similarity
            console.log("[HNSWVizPure] Created initial mesh: ", initialMesh)
            scene.add(initialMesh)
            const initialNode = addNode(initialMesh)

            // Create label for initial node
            const label = createLabel(initialElement.element, initialMesh)
            if (label) {
                scene.add(label)
                initialNode.label = label
            }

            // Delay the initial node click to ensure proper initialization
            setTimeout(() => {
                if (initialMesh && scene.children.includes(initialMesh)) {
                    handleNodeClick(initialMesh, initialNodes)
                }
            }, 0)

            return cleanup
        }

        initializeVisualization()
    }, [scene, initialElement?.element]) // Only depend on scene and initialElement.element

    // Update colors when dark mode changes
    useEffect(() => {
        if (!scene) return

        // Update guide line colors
        updateGuideLineColors(isDarkMode)

        // Update node colors
        nodesRef.current.forEach((node) => {
            ;(node.mesh.material as THREE.MeshBasicMaterial).color.set(
                isDarkMode ? 0xffffff : 0x1a3b4c
            )
        })

        // Update edge colors
        edgesRef.current.forEach((edge) => {
            const material = edge.line.material as THREE.LineBasicMaterial
            // If this edge is currently highlighted, keep it highlighted
            if (highlightedEdgesRef.current.has(edge.line)) {
                material.color.set(isDarkMode ? 0xffffff : 0xff4438)
            } else {
                material.color.set(isDarkMode ? 0xf3ffbb : 0x4a90e2)
            }
        })
    }, [isDarkMode, scene, updateGuideLineColors])

    // Update line visibility
    useEffect(() => {
        edgesRef.current.forEach((edge) => {
            const material = edge.line.material as THREE.LineBasicMaterial
            // If this edge is currently highlighted, keep it highlighted
            if (highlightedEdgesRef.current.has(edge.line)) {
                material.opacity = 0.8 // Keep highlighted edges visible
            } else {
                material.opacity = showLines ? 0.5 : 0
            }
        })
    }, [showLines])

    // Handle card mouse events
    const handleCardMouseEnter = () => {
        if (!isCardPinned) {
            setIsCardCollapsed(false)
        }
    }

    const handleCardMouseLeave = () => {
        if (!isCardPinned) {
            setIsCardCollapsed(true)
        }
    }

    // Handle node expansion
    const expandNode = useCallback(
        async (node: THREE.Mesh, skipLayoutReapplication?: boolean) => {
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
                        setTimeout(() => {
                            applyLayout(currentLayout, forceNode)
                            // Restore the original position after layout is applied
                            node.position.copy(originalPosition)
                            // Update edge geometries connected to this node
                            updateEdgeGeometries(node)
                        }, 100)
                    }
                }

                return
            }

            // If we haven't fetched neighbors yet, get them
            if (!node.userData.expanded) {
                const response = await fetchNeighbors(node.userData.element)

                // Count current total nodes and calculate how many more we can add
                const currentNodeCount = nodesRef.current.length
                // Use maxNodes instead of initialNodes to allow expansion beyond the initial limit
                const remainingSlots = Math.max(0, maxNodes - currentNodeCount)

                if (remainingSlots === 0) {
                    //toast.info(`Maximum number of nodes (${maxNodes}) reached`)
                    return
                }

                let count = 0
                // Take only as many neighbors as we have slots for
                const neighborsToProcess = response.result.slice(
                    0,
                    remainingSlots
                )

                for (const item of neighborsToProcess) {
                    // Check if this element already exists in any node
                    const elementAlreadyExists = nodesRef.current.some(
                        (existingNode) =>
                            existingNode.mesh.userData.element === item.element
                    )

                    // Skip this neighbor if it already exists
                    if (elementAlreadyExists) {
                        console.log(`Skipping duplicate node: ${item.element}`)
                        continue
                    }

                    const angle = Math.random() * Math.PI * 2
                    const radius = 1 + Math.random() * 2
                    const x = node.position.x + Math.cos(angle) * radius
                    const y = node.position.y + Math.sin(angle) * radius
                    const neighbor = createNodeMesh(item.element, item.vector)
                    if (neighbor && scene) {
                        neighbor.userData.similarity = item.similarity
                        scene.add(neighbor)
                        const newNode = addNode(neighbor)

                        // Create edge
                        const points = [node.position, neighbor.position]
                        const geometry =
                            new THREE.BufferGeometry().setFromPoints(points)
                        const material = new THREE.LineBasicMaterial({
                            color: isDarkMode ? 0xf3ffbb : 0x4a90e2,
                            transparent: true,
                            opacity: showLines ? 0.5 : 0,
                        })
                        const line = new THREE.Line(geometry, material)
                        scene.add(line)

                        // Add edge with similarity as strength
                        addEdge(
                            nodesRef.current.find((n) => n.mesh === node)!,
                            newNode,
                            item.similarity,
                            line
                        )
                        count++
                    }

                    // Stop if we've reached the maximum number of nodes
                    if (nodesRef.current.length >= maxNodes) {
                        toast.info(
                            `Maximum number of nodes (${maxNodes}) reached`
                        )
                        break
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
                        setTimeout(() => {
                            applyLayout(currentLayout, forceNode)
                            // Restore the original position after layout is applied
                            node.position.copy(originalPosition)
                            // Update edge geometries connected to this node
                            updateEdgeGeometries(node)
                        }, 100)
                    }
                }
            }
        },
        [
            createNodeMesh,
            addEdge,
            fetchNeighbors,
            maxNodes,
            edgesRef,
            nodesRef,
            currentLayout,
            applyLayout,
            setSelectedNode,
            showLines,
            isDarkMode,
            scene,
        ]
    )

    // Handle node collapse
    const handleCollapseNode = (node: THREE.Mesh) => {
        node.userData.displayState = "collapsed"
        // Additional collapse logic can be added here
    }

    // Handle vector copy
    const handleCopyVector = async () => {
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
    }

    // Handle reset
    const handleReset = useCallback(() => {
        if (!scene || !initialElement) return

        // Clear existing visualization
        // Remove all nodes and their labels
        nodesRef.current.forEach((node) => {
            if (node.mesh) {
                scene.remove(node.mesh)
                if (node.mesh.geometry) node.mesh.geometry.dispose()
                if (node.mesh.material) {
                    if (Array.isArray(node.mesh.material)) {
                        node.mesh.material.forEach((m) => m.dispose())
                    } else {
                        node.mesh.material.dispose()
                    }
                }
                if (node.label) {
                    scene.remove(node.label)
                    if (node.label.material) {
                        if (node.label.material.map)
                            node.label.material.map.dispose()
                        node.label.material.dispose()
                    }
                }
            }
        })

        // Clear all edges
        edgesRef.current.forEach((edge) => {
            if (edge.line) {
                scene.remove(edge.line)
                if (edge.line.geometry) edge.line.geometry.dispose()
                if (edge.line.material && !Array.isArray(edge.line.material)) {
                    edge.line.material.dispose()
                }
            }
        })

        // Clear hover highlight
        if (hoverHighlightRef.current) {
            scene.remove(hoverHighlightRef.current)
            hoverHighlightRef.current = null
        }

        // Reset refs and state
        nodesRef.current = []
        edgesRef.current = []
        highlightedEdgesRef.current.clear()
        selectedNodeRef.current = null
        setSelectedNode(null)
        pulseScaleRef.current = 1
        pulseDirectionRef.current = 1

        // Cancel any ongoing animations
        if (pulseAnimationRef.current) {
            cancelAnimationFrame(pulseAnimationRef.current)
            pulseAnimationRef.current = 0
        }

        // Create initial node with complete similarity item data
        console.log(
            "[HNSWVizPure] Resetting visualization with initial element: ",
            initialElement
        )
        const initialMesh = createNodeMesh(
            initialElement.element,
            initialElement.vector
        )
        initialMesh.userData.similarity = initialElement.similarity
        scene.add(initialMesh)
        const initialNode = addNode(initialMesh)

        // Create label for initial node
        const label = createLabel(initialElement.element, initialMesh)
        if (label) {
            scene.add(label)
            initialNode.label = label
        }

        // Fit camera to the initial node
        fitCameraToNodes()

        // Delay the initial node click to ensure proper initialization
        setTimeout(() => {
            if (initialMesh && scene.children.includes(initialMesh)) {
                handleNodeClick(initialMesh, initialNodes)
                toast.success("Visualization reset successfully")
            }
        }, 100)
    }, [
        scene,
        initialElement,
        createNodeMesh,
        addNode,
        createLabel,
        fitCameraToNodes,
        handleNodeClick,
        initialNodes,
    ])

    // Update renderer background color when dark mode changes
    useEffect(() => {
        if (renderer) {
            // Set the renderer clear color to match the canvas background
            renderer.setClearColor(isDarkMode ? 0x0d1e26 : 0xf5f5f5)
        }
    }, [isDarkMode, renderer])

    return (
        <div
            className="relative w-full"
            style={{
                minHeight: "calc(100vh - 400px)",
                maxHeight: "calc(100vh - 400px)",
            }}
        >
            <canvas
                ref={canvasRef}
                className="w-full h-full"
                style={{ background: isDarkMode ? "#0d1e26" : "#f5f5f5" }}
            />

            {errorMessage && <ErrorMessage message={errorMessage} />}

            <ControlPanel
                selectedNode={selectedNode}
                isDarkMode={isDarkMode}
                showLines={showLines}
                isCardPinned={isCardPinned}
                isCardCollapsed={isCardCollapsed}
                onToggleDarkMode={toggleDarkMode}
                onToggleLineVisibility={toggleLineVisibility}
                onTogglePin={toggleCardPin}
                onExpandNode={expandNode}
                onCollapseNode={handleCollapseNode}
                onCopyVector={handleCopyVector}
                onReset={handleReset}
                onCardMouseEnter={handleCardMouseEnter}
                onCardMouseLeave={handleCardMouseLeave}
            />

            <ZoomControls
                onZoomIn={() => handleZoom(true)}
                onZoomOut={() => handleZoom(false)}
            />

            <HoverLabel
                visible={hoverLabel.visible}
                text={hoverLabel.text}
                x={hoverLabel.x}
                y={hoverLabel.y}
            />

            <LoadingOverlay isVisible={isProjectionRunning} />
        </div>
    )
}

export default HNSWVizPure
