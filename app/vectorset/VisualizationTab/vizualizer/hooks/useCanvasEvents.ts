import { useEffect, useRef, useMemo } from "react"
import { OrthographicCamera, Scene, Mesh, Raycaster, Vector2 } from 'three'

interface UseCanvasEventsProps {
    camera: OrthographicCamera | null
    scene: Scene | null
    onPointClick?: (idx: number) => void
    onPointHover?: (idx: number | null) => void
    updateHoverLabel?: (mesh: Mesh | null, x: number, y: number) => void
    isPanning?: boolean
}

export function useCanvasEvents({
    camera,
    scene,
    onPointClick,
    onPointHover,
    updateHoverLabel,
    isPanning,
}: UseCanvasEventsProps) {
    const raycaster = useMemo(() => new Raycaster(), [])
    const mouse = useMemo(() => new Vector2(), [])
    const canvasRef = useRef<HTMLCanvasElement | null>(null)
    const hoveredNodeRef = useRef<Mesh | null>(null)
    const lastClickTimeRef = useRef<number>(0)
    const lastClickedNodeRef = useRef<Mesh | null>(null)
    const isDraggingRef = useRef<boolean>(false)
    const previousMousePositionRef = useRef<{ x: number; y: number } | null>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas || !camera || !scene) return

        const handleMouseMove = (event: MouseEvent) => {
            // Update mouse position
            const rect = canvas.getBoundingClientRect()
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

            // Skip raycasting during panning for performance
            if (isPanning || isDraggingRef.current) {
                onPointHover?.(null)
                updateHoverLabel?.(null, event.clientX, event.clientY)
                return
            }

            // Update raycaster
            raycaster.setFromCamera(mouse, camera)

            // Check for intersections
            const intersects = raycaster.intersectObjects(scene.children, true)
            const hovered = intersects.find(i => i.object instanceof Mesh)

            if (hovered) {
                const hoveredMesh = hovered.object as Mesh
                onPointHover?.(hoveredMesh.userData.index)
                updateHoverLabel?.(hoveredMesh, event.clientX, event.clientY)
            } else {
                onPointHover?.(null)
                updateHoverLabel?.(null, event.clientX, event.clientY)
            }
        }

        canvas.addEventListener('mousemove', handleMouseMove)
        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove)
        }
    }, [camera, scene, isPanning, onPointHover, updateHoverLabel, mouse, raycaster])

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

            // Only update raycaster if camera is available
            if (camera) {
                raycaster.setFromCamera(mouse, camera)
            }

            // Handle hover effects
            const intersects = raycaster.intersectObjects(scene.children)
            const hovered = intersects.find((i) => i.object.userData.isNode)

            if (hovered) {
                if (hoveredNodeRef.current !== hovered.object) {
                    // New node hovered
                    hoveredNodeRef.current = hovered.object as Mesh
                    onPointHover(hoveredNodeRef.current.userData.index)
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
                onPointHover(null)
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
                const clickedNode = clicked.object as Mesh
                const now = Date.now()
                const timeSinceLastClick = now - lastClickTimeRef.current
                const isDoubleClick =
                    timeSinceLastClick < 300 &&
                    clickedNode === lastClickedNodeRef.current

                if (isDoubleClick) {
                    // Force expand on double click, regardless of current state
                    clickedNode.userData.expanded = false
                    clickedNode.userData.displayState = "expanded"
                    onPointClick(clickedNode.userData.index)
                } else {
                    // Single click behavior - just select the node
                    onPointClick(clickedNode.userData.index)
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
                onPointHover(null)
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
    }, [canvasRef, camera, scene, onPointClick, onPointHover, updateHoverLabel])

    return canvasRef
}
