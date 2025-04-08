import { useEffect, useRef } from "react"
import * as THREE from "three"

export function useCanvasEvents(
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
    const isDraggingRef = useRef<boolean>(false)
    const previousMousePositionRef = useRef<{ x: number; y: number } | null>(
        null
    )

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
                const deltaX =
                    event.clientX - previousMousePositionRef.current.x
                const deltaY =
                    event.clientY - previousMousePositionRef.current.y

                // Convert screen space delta to world space delta based on current zoom level
                const worldDeltaX =
                    (deltaX / canvas.width) * (camera.right - camera.left)
                const worldDeltaY =
                    (deltaY / canvas.height) * (camera.top - camera.bottom)

                // Move the camera in the opposite direction of the mouse movement
                camera.position.x -= worldDeltaX
                camera.position.y += worldDeltaY

                // Update the previous position
                previousMousePositionRef.current = {
                    x: event.clientX,
                    y: event.clientY,
                }

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
            const clickedOnNode = intersects.find(
                (i) => i.object.userData.isNode
            )

            if (!clickedOnNode) {
                isDraggingRef.current = true
                previousMousePositionRef.current = {
                    x: event.clientX,
                    y: event.clientY,
                }
                canvas.style.cursor = "grabbing"
            }
        }

        // Add mouse up handler to stop panning
        const onMouseUp = () => {
            isDraggingRef.current = false
            previousMousePositionRef.current = null
            canvas.style.cursor = "default"
        }

        // Add mouse leave handler to stop panning if mouse leaves canvas
        const onMouseLeave = () => {
            isDraggingRef.current = false
            previousMousePositionRef.current = null
            canvas.style.cursor = "default"
            // Clear hover state when mouse leaves canvas
            if (hoveredNodeRef.current) {
                hoveredNodeRef.current = null
                onNodeHover(null)
                updateHoverLabel(null, 0, 0)
            }
        }

        // Add wheel handler for zooming
        const onWheel = (event: WheelEvent) => {
            event.preventDefault()

            // Make zoom less sensitive and smoother
            const zoomSensitivity = 0.05
            const zoomAmount = event.deltaY * zoomSensitivity
            const zoomFactor =
                1 +
                (zoomAmount > 0
                    ? Math.min(zoomAmount, 0.1)
                    : Math.max(zoomAmount, -0.1))

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
