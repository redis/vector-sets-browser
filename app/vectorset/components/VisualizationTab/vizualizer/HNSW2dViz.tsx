"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import * as THREE from "three"
import {
    ControlPanel,
    HoverLabel,
    LoadingOverlay,
    ZoomControls,
} from "./components"
import {
    useCanvasEvents,
    useForceSimulator,
    useLayoutManager,
    useNodeManager,
    useThreeScene,
    useVisualizationState,
} from "./hooks"
import type { HNSWVizPureProps } from "./types"
import { vemb } from "@/app/redis-server/api"
import { COLORS_REDIS_DARK, COLORS_REDIS_LIGHT, NODE_SIZE } from "./constants"

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
    vectorSetName,
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
        updateSceneBackground,
    } = useThreeScene()

    // Cast the ref to the required non-null type for compatibility with other hooks
    const typedCanvasRef = canvasRef as React.RefObject<HTMLCanvasElement>;

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
            
            // Use the same approach as the wheel zoom in useCanvasEvents
            // Define a zoom factor similar to the wheel event
            const zoomFactor = zoomIn ? 0.9 : 1.1  // 0.9 for zoom in, 1.1 for zoom out
            
            // Get current dimensions
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
            
            // Update label scales and anything else needed
            updateLabelScales()
            
            // No need to call originalHandleZoom as it's now redundant
        },
        [camera, updateLabelScales]
    )

    // Animation loop ref
    const animationFrameRef = useRef<number>(null)

    // Set up animation loop
    useEffect(() => {
        const animate = () => {
            if (camera && renderer && scene) {
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
    }, [camera, renderer, scene, updateLabelScales])

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
        typedCanvasRef
    )

    // Initialize node management
    const { errorMessage, fetchNeighbors } = useNodeManager(
        maxNodes,
        getNeighbors
    )

    // Function to create a node mesh
    const createNodeMesh = (element: string, vector?: number[]) => {
        const geometry = new THREE.SphereGeometry(NODE_SIZE.DEFAULT, 32, 32)
        const material = new THREE.MeshBasicMaterial({
            color: isDarkMode ? COLORS_REDIS_DARK.NODE.DEFAULT : COLORS_REDIS_LIGHT.NODE.DEFAULT,
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
            const geometry = new THREE.SphereGeometry(NODE_SIZE.HIGHLIGHT, 32, 32)
            const material = new THREE.MeshBasicMaterial({
                color: isDarkMode ? COLORS_REDIS_DARK.NODE.HOVER_HIGHLIGHT : COLORS_REDIS_LIGHT.NODE.HOVER_HIGHLIGHT,
                transparent: true,
                opacity: 1,
            })
            const highlight = new THREE.Mesh(geometry, material)
            highlight.position.copy(mesh.position)
            scene.add(highlight)
            hoverHighlightRef.current = highlight

            // Update hover label text
            const elementName = mesh.userData.element
            
            // Truncate long text but handle multi-line content properly
            // Check if the element name contains newlines
            const lines = elementName.split('\n');
            const truncatedLines = lines.map((line: string) => 
                line.length > 80 ? line.substring(0, 77) + "..." : line
            );
            const truncatedText = truncatedLines.join('\n');

            let labelText = truncatedText;

            // Add similarity if available
            if (
                mesh.userData.similarity !== null &&
                mesh.userData.similarity !== undefined
            ) {
                labelText += `\nSimilarity: ${mesh.userData.similarity.toFixed(4)}`
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

        // Clear hover highlight if it exists
        if (hoverHighlightRef.current) {
            scene.remove(hoverHighlightRef.current)
            hoverHighlightRef.current = null
        }

        // Update selected node
        selectedNodeRef.current = mesh
        setSelectedNode(mesh)

        // Set selected node color
        const material = mesh.material as THREE.MeshBasicMaterial
        material.color.set(isDarkMode ? COLORS_REDIS_DARK.NODE.SELECTED : COLORS_REDIS_LIGHT.NODE.SELECTED)
        material.needsUpdate = true

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
        console.log("fetchNeighbors response", response)
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

                // Create edge
                const points = [mesh.position, newMesh.position]
                const geometry = new THREE.BufferGeometry().setFromPoints(
                    points
                )
                const material = new THREE.LineBasicMaterial({
                    color: isDarkMode ? COLORS_REDIS_DARK.EDGE.DEFAULT : COLORS_REDIS_LIGHT.EDGE.DEFAULT,
                    transparent: true,
                    opacity: showLines ? 1 : 0,
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
            material.color.set(isDarkMode ? COLORS_REDIS_DARK.EDGE.DEFAULT : COLORS_REDIS_LIGHT.EDGE.DEFAULT)
            material.opacity = showLines ? 0.5 : 0
        })
        highlightedEdgesRef.current.clear()

        if (mesh) {
            // Don't create hover highlight for the currently selected node
            // Just highlight its edges but keep the selected state visually distinct
            const isSelectedNode = selectedNodeRef.current === mesh;
            
            if (!isSelectedNode) {
                // Create node highlight effect (only for non-selected nodes)
                const geometry = new THREE.SphereGeometry(NODE_SIZE.HIGHLIGHT, 32, 32)
                const material = new THREE.MeshBasicMaterial({
                    color: isDarkMode ? COLORS_REDIS_DARK.NODE.HOVER_HIGHLIGHT : COLORS_REDIS_LIGHT.NODE.HOVER_HIGHLIGHT,
                    transparent: true,
                    opacity: 1,
                })
                const highlight = new THREE.Mesh(geometry, material)
                highlight.position.copy(mesh.position)
                scene.add(highlight)
                hoverHighlightRef.current = highlight
            }

            // Highlight edges connected to this node
            edgesRef.current.forEach((edge) => {
                if (edge.source.mesh === mesh || edge.target.mesh === mesh) {
                    const material = edge.line
                        .material as THREE.LineBasicMaterial
                    // Use a brighter color for the highlighted edges
                    material.color.set(isDarkMode ? COLORS_REDIS_DARK.NODE.SELECTED : COLORS_REDIS_LIGHT.NODE.SELECTED)
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
        typedCanvasRef,
        camera,
        scene,
        handleNodeClick,
        handleNodeHover,
        updateHoverLabel
    )

    // Update colors of previously selected nodes when a new selection is made
    useEffect(() => {
        if (!scene) return
        
        // Reset all node colors to default first
        nodesRef.current.forEach((node) => {
            // Skip the currently selected node
            if (node.mesh === selectedNodeRef.current) return;
            
            const material = node.mesh.material as THREE.MeshBasicMaterial;
            material.color.set(isDarkMode ? COLORS_REDIS_DARK.NODE.DEFAULT : COLORS_REDIS_LIGHT.NODE.DEFAULT);
            material.needsUpdate = true;
        });
        
    }, [selectedNode, isDarkMode, scene]);

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

            // Check if we have a vector, if not fetch it
            let vector = initialElement.vector
            if (!vector || vector.length === 0) {
                try {
                    const response = await vemb({
                        keyName: vectorSetName,
                        element: initialElement.element,
                        returnCommandOnly: false
                    })
                    if (response.success && response.result) {
                        vector = response.result
                    } else {
                        console.error("Failed to fetch vector:", response.error)
                    }
                } catch (error) {
                    console.error("Error fetching vector:", error)
                }
            }

            // Creating initial node with complete similarity item data
            const initialMesh = createNodeMesh(
                initialElement.element,
                vector
            )
            initialMesh.userData.similarity = initialElement.similarity
            scene.add(initialMesh)
            addNode(initialMesh)

            // Delay the initial node click to ensure proper initialization
            setTimeout(() => {
                if (initialMesh && scene.children.includes(initialMesh)) {
                    handleNodeClick(initialMesh, initialNodes)
                }
            }, 0)

            return cleanup
        }

        initializeVisualization()
    }, [scene, initialElement?.element, vectorSetName]) // Add vectorSetName to dependencies

    // Update colors when dark mode changes
    useEffect(() => {
        if (!scene || !renderer) return

        console.log("Dark mode changed to:", isDarkMode);

        // Update guide line colors
        updateGuideLineColors(isDarkMode)

        // Update node colors
        nodesRef.current.forEach((node) => {
            const material = node.mesh.material as THREE.MeshBasicMaterial;
            material.color.set(isDarkMode ? COLORS_REDIS_DARK.NODE.DEFAULT : COLORS_REDIS_LIGHT.NODE.DEFAULT);
            material.needsUpdate = true;
        })

        // Update edge colors
        edgesRef.current.forEach((edge) => {
            const material = edge.line.material as THREE.LineBasicMaterial
            // If this edge is currently highlighted, keep it highlighted
            if (highlightedEdgesRef.current.has(edge.line)) {
                material.color.set(isDarkMode ? COLORS_REDIS_DARK.NODE.SELECTED : COLORS_REDIS_LIGHT.NODE.SELECTED)
            } else {
                material.color.set(isDarkMode ? COLORS_REDIS_DARK.EDGE.DEFAULT : COLORS_REDIS_LIGHT.EDGE.DEFAULT)
            }
            material.needsUpdate = true
        })

        // Force a render to update the scene
        if (camera) {
            renderer.render(scene, camera)
        }
    }, [isDarkMode, scene, renderer, camera, updateGuideLineColors])

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
                console.log("neighbors response", response)
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
                        continue
                    }

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
                            color: isDarkMode ? COLORS_REDIS_DARK.EDGE.DEFAULT : COLORS_REDIS_LIGHT.EDGE.DEFAULT,
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
        const initialMesh = createNodeMesh(
            initialElement.element,
            initialElement.vector
        )
        initialMesh.userData.similarity = initialElement.similarity
        scene.add(initialMesh)
        addNode(initialMesh)

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
        fitCameraToNodes,
        handleNodeClick,
        initialNodes,
    ])

    // Update renderer and canvas background color directly
    useEffect(() => {
        console.log("Updating background colors for dark mode:", isDarkMode);
        
        // Update the THREE.js scene background
        if (scene) {
            updateSceneBackground(isDarkMode);
        }
        
        // Update renderer
        if (renderer) {
            const backgroundHex = isDarkMode 
                ? COLORS_REDIS_DARK.BACKGROUND 
                : COLORS_REDIS_LIGHT.BACKGROUND;
                
            // Convert the background hex to a number if it's a string
            let bgColor: number;
            if (typeof backgroundHex === 'string' && backgroundHex.startsWith('#')) {
                // Remove the # and convert hex string to number - need to cast to unknown first for TypeScript
                bgColor = parseInt(backgroundHex.substring(1), 16);
            } else if (typeof backgroundHex === 'number') {
                bgColor = backgroundHex;
            } else {
                // Fallback to a default color if something goes wrong
                bgColor = isDarkMode ? 0x0d1e26 : 0xffffff;
                console.warn('Unexpected background color format:', backgroundHex);
            }
            
            console.log("Setting renderer clear color:", bgColor.toString(16));
            renderer.setClearColor(bgColor);
        }
        
        // Update canvas background directly for consistency
        if (canvasRef.current) {
            // Use the same predefined values that we know work correctly
            const cssColor = isDarkMode ? "#0d1e26" : "#ffffff";
            console.log("Setting canvas background style:", cssColor);
            canvasRef.current.style.background = cssColor;
        }
        
        // Force a re-render if scene is available
        if (scene && camera && renderer) {
            renderer.render(scene, camera);
        }
    }, [isDarkMode, renderer, scene, camera, canvasRef, updateSceneBackground]);

    // Add better cleanup for THREE.js resources
    useEffect(() => {
        return () => {
            // Dispose of all geometries and materials
            
            if (scene) {
                scene.traverse((object) => {
                    if (object instanceof THREE.Mesh) {
                        if (object.geometry) object.geometry.dispose();
                        if (object.material) {
                            if (Array.isArray(object.material)) {
                                object.material.forEach(material => material.dispose());
                            } else {
                                object.material.dispose();
                            }
                        }
                    }
                });
            }
            
            // Dispose of renderer
            if (renderer) {
                renderer.dispose();
                renderer.forceContextLoss();
            }
        };
    }, []);

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
