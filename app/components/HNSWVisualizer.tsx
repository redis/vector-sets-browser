import React, { useEffect, useRef, useState } from "react"
import * as THREE from "three"

interface HNSWVisualizerProps {
    keyName: string
    initialElement: string
    maxNodes?: number
    initialNodes?: number // Number of nodes to show on initial load
}

interface VLinkResponse {
    success: boolean
    result: Array<[string, number][]> // Array of levels, each containing [node, score] pairs
}

const HNSWVisualizer: React.FC<HNSWVisualizerProps> = ({
    keyName,
    initialElement,
    maxNodes = 100,
    initialNodes = 20, // Default to showing 20 nodes
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const labelsRef = useRef<HTMLDivElement>(null)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    useEffect(() => {
        if (!canvasRef.current) return

        // Set up Three.js scene, camera, and renderer
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0xffffff)
        const aspect = window.innerWidth / window.innerHeight
        const frustumSize = 20
        const camera = new THREE.OrthographicCamera(
            (frustumSize * aspect) / -2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.1,
            1000
        )
        camera.position.set(0, 0, 10)
        
        // Add zoom state
        let currentZoom = 1
        const MIN_ZOOM = 0.1
        const MAX_ZOOM = 10
        
        // Function to update camera zoom
        const updateZoom = (delta: number) => {
            const zoomSpeed = 0.1
            const newZoom = currentZoom * (1 + delta * zoomSpeed)
            currentZoom = Math.min(Math.max(newZoom, MIN_ZOOM), MAX_ZOOM)
            
            const aspect = canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.clientHeight : 1
            camera.left = (frustumSize * aspect * currentZoom) / -2
            camera.right = (frustumSize * aspect * currentZoom) / 2
            camera.top = (frustumSize * currentZoom) / 2
            camera.bottom = (frustumSize * currentZoom) / -2
            camera.updateProjectionMatrix()
        }

        // Wheel event handler for zooming
        const onWheel = (event: WheelEvent) => {
            event.preventDefault()
            const delta = event.deltaY > 0 ? 1 : -1
            updateZoom(delta)
        }

        const renderer = new THREE.WebGLRenderer({ 
            canvas: canvasRef.current,
            antialias: true
        })

        // Create raycaster for mouse interaction
        const raycaster = new THREE.Raycaster()
        const mouse = new THREE.Vector2()

        // Force-directed layout parameters
        const REPULSION = 1.0
        const SPRING_LENGTH = 3.0
        const SPRING_COEFFICIENT = 0.1
        const TIMESTEP = 0.1
        const ITERATIONS_PER_FRAME = 10
        const MIN_MOVEMENT = 0.001

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
        }

        const forceNodes: ForceNode[] = []
        const forceEdges: ForceEdge[] = []
        
        const renderedNodes = new Set<string>()

        // Create label content with debug info
        const updateLabelContent = (node: THREE.Mesh) => {
            const data = node.userData
            const labelContent = [
                `Element: ${data.element}`,
                data.similarity !== null ? `Similarity: ${data.similarity.toFixed(4)}` : null,
                `Neighbors: ${data.neighborCount}`,
                `Expanded: ${data.expanded}`,
            ].filter(Boolean).join('\n')
            
            if (data.labelDiv) {
                data.labelDiv.textContent = labelContent
            }
        }

        // Function to update camera to fit all nodes
        const updateCameraView = () => {
            if (forceNodes.length === 0) return

            // Find bounds of all nodes
            let minX = Infinity
            let maxX = -Infinity
            let minY = Infinity
            let maxY = -Infinity

            forceNodes.forEach(node => {
                minX = Math.min(minX, node.mesh.position.x)
                maxX = Math.max(maxX, node.mesh.position.x)
                minY = Math.min(minY, node.mesh.position.y)
                maxY = Math.max(maxY, node.mesh.position.y)
            })

            // Add padding
            const padding = 2
            minX -= padding
            maxX += padding
            minY -= padding
            maxY += padding

            // Calculate required frustum size to fit all nodes
            const width = maxX - minX
            const height = maxY - minY
            const aspect = canvasRef.current ? canvasRef.current.clientWidth / canvasRef.current.clientHeight : 1
            const newFrustumSize = Math.max(width / aspect, height)

            // Update camera
            camera.left = (newFrustumSize * aspect) / -2
            camera.right = (newFrustumSize * aspect) / 2
            camera.top = newFrustumSize / 2
            camera.bottom = newFrustumSize / -2

            // Center the view on the nodes
            const centerX = (minX + maxX) / 2
            const centerY = (minY + maxY) / 2
            scene.position.x = -centerX
            scene.position.y = -centerY

            camera.updateProjectionMatrix()
        }
        
        // Function to update renderer size based on parent container
        const updateSize = () => {
            const parent = canvasRef.current?.parentElement
            if (!parent) return
            
            const width = parent.clientWidth
            const height = parent.clientHeight
            const aspect = width / height
            
            // Update camera aspect
            camera.left = (camera.top * aspect) * -1
            camera.right = (camera.top * aspect)
            camera.updateProjectionMatrix()
            
            renderer.setSize(width, height)
            updateCameraView() // Ensure nodes stay in view after resize
        }
        
        // Initial size update
        updateSize()
        
        // Add resize observer to handle parent container size changes
        const resizeObserver = new ResizeObserver(updateSize)
        if (canvasRef.current?.parentElement) {
            resizeObserver.observe(canvasRef.current.parentElement)
        }

        // Function to retrieve neighbors of a node using VLINK
        const getNeighbors = async (element: string): Promise<VLinkResponse> => {
            try {
                if (!element) { 
                    setErrorMessage("Element is undefined")
                    return { success: false, result: [] }
                }
                console.log("Fetching neighbors for element:", element)
                const params = {
                    method: "POST",
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        keyName,
                        element,
                        count: maxNodes
                    })
                }
                console.log("Params:", params)
                const response = await fetch(`/api/redis/command/vlink`, params)
                const data = await response.json()
                console.log("VLINK Response:", data)
                if (!data.success) {
                    setErrorMessage("VLINK request failed")
                    return { success: false, result: [] }
                }
                return data
            } catch (error) {
                setErrorMessage("Error fetching neighbors")
                return { success: false, result: [] }
            }
        }

        // Function to apply force-directed layout
        const applyForceLayout = () => {
            // Reset forces
            forceNodes.forEach(node => {
                node.force.set(0, 0)
                node.velocity.multiplyScalar(0.9) // Add damping
            })

            // Calculate repulsive forces between all nodes
            for (let i = 0; i < forceNodes.length; i++) {
                for (let j = i + 1; j < forceNodes.length; j++) {
                    const nodeA = forceNodes[i]
                    const nodeB = forceNodes[j]
                    const dx = nodeB.mesh.position.x - nodeA.mesh.position.x
                    const dy = nodeB.mesh.position.y - nodeA.mesh.position.y
                    const distSq = dx * dx + dy * dy
                    const dist = Math.sqrt(distSq)

                    if (dist > 0) {
                        // Repulsive force
                        const force = REPULSION / distSq
                        const fx = (dx / dist) * force
                        const fy = (dy / dist) * force

                        nodeA.force.x -= fx
                        nodeA.force.y -= fy
                        nodeB.force.x += fx
                        nodeB.force.y += fy
                    }
                }
            }

            // Calculate spring forces for edges
            forceEdges.forEach(edge => {
                const dx = edge.target.mesh.position.x - edge.source.mesh.position.x
                const dy = edge.target.mesh.position.y - edge.source.mesh.position.y
                const dist = Math.sqrt(dx * dx + dy * dy)

                if (dist > 0) {
                    const force = (dist - SPRING_LENGTH) * SPRING_COEFFICIENT * edge.strength
                    const fx = (dx / dist) * force
                    const fy = (dy / dist) * force

                    edge.source.force.x += fx
                    edge.source.force.y += fy
                    edge.target.force.x -= fx
                    edge.target.force.y -= fy
                }
            })

            // Update positions
            let maxMovement = 0
            forceNodes.forEach(node => {
                node.velocity.x += node.force.x * TIMESTEP
                node.velocity.y += node.force.y * TIMESTEP

                const movement = Math.sqrt(
                    node.velocity.x * node.velocity.x + 
                    node.velocity.y * node.velocity.y
                ) * TIMESTEP

                maxMovement = Math.max(maxMovement, movement)

                node.mesh.position.x += node.velocity.x * TIMESTEP
                node.mesh.position.y += node.velocity.y * TIMESTEP
            })

            // Update edge positions
            forceEdges.forEach(edge => {
                const points = [
                    edge.source.mesh.position.clone(),
                    edge.target.mesh.position.clone()
                ]
                const geometry = edge.line.geometry as THREE.BufferGeometry
                geometry.setFromPoints(points)
            })

            return maxMovement > MIN_MOVEMENT
        }

        // Function to render a node
        const renderNode = (element: string, x: number, y: number): THREE.Mesh | null => {
            if (renderedNodes.has(element)) return null;

            renderedNodes.add(element);

            const geometry = new THREE.CircleGeometry(0.5, 32);
            const material = new THREE.MeshBasicMaterial({ 
                color: 0x4a90e2,
                transparent: true,
                opacity: 0.8
            });
            const circle = new THREE.Mesh(geometry, material);
            circle.position.set(x, y, 0);
            
            // Create label
            const labelDiv = document.createElement('div')
            labelDiv.className = 'node-label'
            // Store initial info in userData
            circle.userData = { 
                element,
                isNode: true,
                labelDiv,
                neighborCount: 0,
                expanded: false,
                similarity: null // Will be set for neighbor nodes
            }
            
            updateLabelContent(circle)
            labelDiv.style.display = 'none'
            
            if (labelsRef.current) {
                labelsRef.current.appendChild(labelDiv)
            }
            
            scene.add(circle)

            // Add to force simulation
            forceNodes.push({
                mesh: circle,
                velocity: new THREE.Vector2(0, 0),
                force: new THREE.Vector2(0, 0)
            })

            return circle
        }

        // Function to render connections between nodes
        const renderConnection = (
            startNode: THREE.Mesh,
            endNode: THREE.Mesh,
            similarity: number
        ): THREE.Line => {
            const points = [
                startNode.position.clone(),
                endNode.position.clone()
            ]
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points)
            const lineMaterial = new THREE.LineBasicMaterial({
                color: 0x4a90e2,
                transparent: true,
                opacity: Math.min(similarity, 0.8)
            })
            const line = new THREE.Line(lineGeometry, lineMaterial)
            scene.add(line)

            // Add to force simulation
            const sourceNode = forceNodes.find(n => n.mesh === startNode)
            const targetNode = forceNodes.find(n => n.mesh === endNode)
            
            if (sourceNode && targetNode) {
                forceEdges.push({
                    source: sourceNode,
                    target: targetNode,
                    line,
                    strength: similarity
                })
            }

            return line
        }

        // Function to auto-expand nodes until we reach target count
        const autoExpandNodes = async (startNode: THREE.Mesh, targetCount: number) => {
            const queue: THREE.Mesh[] = [startNode]
            const expanded = new Set<string>()
            let totalNodes = 1 // Count the initial node

            while (queue.length > 0 && totalNodes < targetCount) {
                const currentNode = queue.shift()!
                if (expanded.has(currentNode.userData.element)) continue
                
                const response = await getNeighbors(currentNode.userData.element)
                if (!response.success) continue

                expanded.add(currentNode.userData.element)
                
                response.result.forEach((level: [string, number][]) => {
                    level.forEach(([neighborElement, similarity]) => {
                        if (totalNodes >= targetCount) return
                        
                        const angle = Math.random() * Math.PI * 2
                        const radius = 1 + Math.random() * 2
                        const x = currentNode.position.x + Math.cos(angle) * radius
                        const y = currentNode.position.y + Math.sin(angle) * radius
                        
                        const neighborCircle = renderNode(neighborElement, x, y)
                        if (neighborCircle) {
                            neighborCircle.userData.similarity = similarity
                            renderConnection(currentNode, neighborCircle, similarity)
                            queue.push(neighborCircle)
                            totalNodes++
                        }
                    })
                })

                currentNode.userData.neighborCount = response.result.flat().length
                currentNode.userData.expanded = true
                updateLabelContent(currentNode)
            }

            updateCameraView()
        }

        // Function to expand a single node
        const expandNode = async (element: string, parentCircle: THREE.Mesh) => {
            console.log("Expanding node:", element)

            const response = await getNeighbors(element)
            console.log("Got neighbor response:", response)

            if (!response.success || !response.result || !response.result.length) {
                console.error("No valid neighbors found")
                return
            }

            // Store expanded state to prevent re-expansion
            if (parentCircle.userData.expanded) {
                console.log("Node already expanded")
                return
            }
            parentCircle.userData.expanded = true

            let nodeCount = 0
            response.result.forEach((level: [string, number][]) => {
                level.forEach(([neighborElement, similarity]) => {
                    if (nodeCount >= maxNodes) return

                    const angle = Math.random() * Math.PI * 2
                    const radius = 1 + Math.random() * 2
                    const x = parentCircle.position.x + Math.cos(angle) * radius
                    const y = parentCircle.position.y + Math.sin(angle) * radius
                    
                    const neighborCircle = renderNode(neighborElement, x, y)
                    if (neighborCircle) {
                        neighborCircle.userData.similarity = similarity
                        renderConnection(parentCircle, neighborCircle, similarity)
                        nodeCount++
                    }
                })
            })

            // Update parent node's metadata
            parentCircle.userData.neighborCount = nodeCount
            parentCircle.userData.expanded = true
            updateLabelContent(parentCircle)
            updateCameraView()
        }

        // Mouse move handler for hover effects
        const onMouseMove = (event: MouseEvent) => {
            if (!canvasRef.current) return

            // Get canvas-relative coordinates
            const rect = canvasRef.current.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

            raycaster.setFromCamera(mouse, camera)
            const intersects = raycaster.intersectObjects(scene.children)
            
            // Hide all labels and reset node colors
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh && object.userData.isNode) {
                    (object.material as THREE.MeshBasicMaterial).color.setHex(0x4a90e2)
                    if (object.userData.labelDiv) {
                        object.userData.labelDiv.style.display = 'none'
                    }
                }
            })

            // Show label and highlight hovered node
            const hoveredNode = intersects.find(intersect => 
                intersect.object instanceof THREE.Mesh && 
                intersect.object.userData.isNode
            )
            
            if (hoveredNode && canvasRef.current) {
                const mesh = hoveredNode.object as THREE.Mesh
                ;(mesh.material as THREE.MeshBasicMaterial).color.setHex(0xff0000)
                if (mesh.userData.labelDiv) {
                    const labelDiv = mesh.userData.labelDiv as HTMLDivElement
                    
                    // Show label
                    labelDiv.style.display = 'block'
                    
                    // Get canvas-relative mouse coordinates
                    const rect = canvasRef.current.getBoundingClientRect()
                    const x = event.clientX - rect.left
                    const y = event.clientY - rect.top
                    
                    // Position slightly above mouse cursor
                    labelDiv.style.left = `${x}px`
                    labelDiv.style.top = `${y - 30}px`
                }
            }
        }

        // Click handler for node expansion
        const onClick = (event: MouseEvent) => {
            if (!canvasRef.current) return

            // Get canvas-relative coordinates
            const rect = canvasRef.current.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

            raycaster.setFromCamera(mouse, camera)
            const intersects = raycaster.intersectObjects(scene.children)
            
            const clickedNode = intersects.find(intersect => 
                intersect.object instanceof THREE.Mesh && 
                intersect.object.userData.isNode
            )

            if (clickedNode) {
                console.log("Node clicked:", clickedNode.object.userData.element)
                const mesh = clickedNode.object as THREE.Mesh
                expandNode(mesh.userData.element, mesh)
            }
        }

        // Add event listeners
        window.addEventListener('mousemove', onMouseMove)
        window.addEventListener('click', onClick)

        // Render initial node and auto-expand for initial load
        console.log("Rendering initial node:", initialElement)
        const initialCircle = renderNode(initialElement, 0, 0)
        autoExpandNodes(initialCircle, initialNodes)

        // Animation loop
        const animate = () => {
            requestAnimationFrame(animate)
            
            // Run multiple iterations of force layout per frame
            let isStillMoving = false
            for (let i = 0; i < ITERATIONS_PER_FRAME; i++) {
                if (applyForceLayout()) {
                    isStillMoving = true
                }
            }
            
            // Update camera view if nodes are still moving
            if (isStillMoving) {
                updateCameraView()
            }
            
            renderer.render(scene, camera)
        }
        animate()

        // Add wheel event listener
        canvasRef.current.addEventListener('wheel', onWheel)

        // Clean up
        return () => {
            resizeObserver.disconnect()
            window.removeEventListener('mousemove', onMouseMove)
            window.removeEventListener('click', onClick)
            canvasRef.current?.removeEventListener('wheel', onWheel)

            // Dispose of all geometries and materials
            scene.traverse((object) => {
                if (object instanceof THREE.Mesh) {
                    object.geometry.dispose()
                    if (Array.isArray(object.material)) {
                        object.material.forEach(material => material.dispose())
                    } else {
                        object.material.dispose()
                    }
                }
            })

            // Remove all objects from the scene
            while(scene.children.length > 0) { 
                scene.remove(scene.children[0])
            }

            renderer.dispose()

            // Remove all labels
            if (labelsRef.current) {
                labelsRef.current.innerHTML = ''
            }
        }
    }, [keyName, initialElement, maxNodes, initialNodes])

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', height: '100%' }}>
            {errorMessage && <div className="error-message">{errorMessage}</div>}
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            <div 
                ref={labelsRef} 
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    pointerEvents: 'none',
                    width: '100%',
                    height: '100%',
                    zIndex: 1
                }}
            />
            <style jsx>{`
                .node-label {
                    position: absolute;
                    font-size: 14px;
                    color: #000;
                    background: rgba(255, 255, 255, 0.95);
                    padding: 8px 12px;
                    border-radius: 4px;
                    white-space: pre-line;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    pointer-events: none;
                    z-index: 2;
                    transform: translate(-50%, 0);
                    font-family: monospace;
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
            `}</style>
        </div>
    )
}

export default HNSWVisualizer
