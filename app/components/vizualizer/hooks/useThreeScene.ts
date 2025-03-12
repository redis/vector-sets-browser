import { useRef, useState, useEffect, useCallback } from "react"
import * as THREE from "three"
import { COLORS_REDIS_DARK, COLORS_REDIS_LIGHT, ColorScheme } from "../constants"

let COLORS: ColorScheme = COLORS_REDIS_DARK

export function useThreeScene() {
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

    // Function to create guide lines
    const createGuideLines = useCallback((scene: THREE.Scene) => {
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
        horizontalLine.computeLineDistances();
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
        verticalLine.computeLineDistances();
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
            if (i === 0) continue;
            
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
            if (i === 0) continue;
            
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
    }, []);

    // Function to update guide line colors
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

    // Function to fit camera to nodes
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

        // Add minimal padding (10% instead of 70%)
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
                const newSize = 20 / level
                targetFrustumSizeRef.current = newSize

                // If auto zoom is off, we need to manually update the target frustum size
                if (!isAutoZoom) {
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
            isInitialZoomRef.current = true
            setTimeout(() => fitCameraToNodes(), 0)
        }
    }, [scene, camera, fitCameraToNodes])

    // Initialize Three.js scene
    useEffect(() => {
        if (!canvasRef.current) return

        // Create scene
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(COLORS.BACKGROUND)

        // Add guide lines at the origin
        createGuideLines(scene)

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
    }, [createGuideLines])

    // Add handleZoom function to the hook's return value
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
        handleZoom,
    }
} 