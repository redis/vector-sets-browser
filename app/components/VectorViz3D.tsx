import React, { useRef, useState, useCallback } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { OrbitControls, Html, PerspectiveCamera } from "@react-three/drei"
import { Vector3, Box3, Mesh } from "three"
import { OrbitControls as OrbitControlsImpl } from "three-stdlib"

// Type definition for data points
interface DataPoint {
    label: string
    vector: number[]
}

interface VectorViz3DProps {
    data: DataPoint[]
}

// UMAP-inspired dimensionality reduction for 3D visualization
function reduceToThreeD(vectors: number[][]): number[][] {
    if (vectors.length === 0) return []

    // If vectors are already 3D or less, return them directly
    if (vectors[0].length <= 3) {
        return vectors.map((v) => {
            while (v.length < 3) v.push(0)
            return v.slice(0, 3)
        })
    }

    // Compute distance matrix
    const distMatrix = vectors.map((v1) =>
        vectors.map((v2) => {
            // Cosine similarity
            const dotProduct = v1.reduce((sum, val, i) => sum + val * v2[i], 0)
            const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0))
            const mag2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0))
            const cosSim = dotProduct / (mag1 * mag2) || 0
            // Convert to distance (1 - similarity)
            return 1 - cosSim
        })
    )

    // Simple MDS-inspired approach
    const positions: number[][] = []

    // Initialize with random positions
    for (let i = 0; i < vectors.length; i++) {
        positions.push([
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
        ])
    }

    // Simple force-directed layout
    const iterations = 50
    const learningRate = 0.1

    for (let iter = 0; iter < iterations; iter++) {
        for (let i = 0; i < vectors.length; i++) {
            const forces = [0, 0, 0]

            for (let j = 0; j < vectors.length; j++) {
                if (i === j) continue

                // Current distance in 3D space
                const dx = positions[i][0] - positions[j][0]
                const dy = positions[i][1] - positions[j][1]
                const dz = positions[i][2] - positions[j][2]
                const currentDist =
                    Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.001

                // Target distance from distance matrix
                const targetDist = distMatrix[i][j] * 3

                // Force direction
                const fx = (dx / currentDist) * (targetDist - currentDist)
                const fy = (dy / currentDist) * (targetDist - currentDist)
                const fz = (dz / currentDist) * (targetDist - currentDist)

                forces[0] += fx
                forces[1] += fy
                forces[2] += fz
            }

            // Apply forces with decreasing learning rate
            const currentLR = learningRate * (1 - iter / iterations)
            positions[i][0] += forces[0] * currentLR
            positions[i][1] += forces[1] * currentLR
            positions[i][2] += forces[2] * currentLR
        }
    }

    return positions
}

// Calculate a color based on vector properties
function getVectorColor(vector: number[]): string {
    // Define a pleasing color palette
    const palette = [
        "#2176AE", 
        "#57B8FF", 
        "#6FA6C3", 
        "#879386", 
        "#b66d0d", 
        "#00ACC1", 
        "#fbb13c", 
        "#fd8d42", 
        "#fe6847", 
    ]

    // Use a hash of the vector to pick a color
    // This ensures the same vector always gets the same color
    let hash = 0
    for (let i = 0; i < vector.length; i++) {
        // Create a simple hash based on vector values
        hash = (hash << 5) - hash + Math.floor(vector[i] * 1000)
        hash = hash & hash // Convert to 32bit integer
    }

    // Make sure hash is positive
    hash = Math.abs(hash)

    // Use the hash to select a color from the palette
    return palette[hash % palette.length]
}

// Vector point component
const VectorPoint = ({
    position,
    label,
    color,
    size = 0.1,
    labelScale = 1.0,
    labelBgOpacity = 0.8,
    selected = false,
    onClick,
}: {
    position: [number, number, number]
    label: string
    color: string
    size?: number
    labelScale?: number
    labelBgOpacity?: number
    selected?: boolean
    onClick?: () => void
}) => {
    const meshRef = useRef<Mesh>(null)
    const [hovered, setHovered] = useState(false)

    useFrame(() => {
        if (meshRef.current && selected) {
            meshRef.current.rotation.y += 0.01
            meshRef.current.rotation.x += 0.01
        }
    })

    // Extract similarity from label if present
    let displayLabel = label
    let similarity: string | null = null

    // Check if the label contains a similarity value in parentheses
    const similarityMatch = label.match(/\(([\d.]+)\)$/)
    if (similarityMatch) {
        // Extract the similarity value
        similarity = similarityMatch[1]
        // Remove the similarity part from the display label
        displayLabel = label.replace(/\s*\([\d.]+\)$/, "")
    }

    return (
        <group position={position}>
            <mesh 
                ref={meshRef} 
                onClick={onClick}
                onPointerOver={() => setHovered(true)}
                onPointerOut={() => setHovered(false)}
            >
                <sphereGeometry args={[size, 24, 24]} />
                <meshStandardMaterial
                    color={color}
                    emissive={color}
                    emissiveIntensity={hovered ? 0.4 : 1.0}
                    roughness={0.3}
                    metalness={0.5}
                    transparent={true}
                    opacity={hovered || selected ? 1 : 0.5}
                />
                {selected && (
                    <mesh position={[0, 0, 0]}>
                        <sphereGeometry args={[size * 1.3, 16, 16]} />
                        <meshStandardMaterial
                            color="white"
                            transparent={true}
                            opacity={0.1}
                            wireframe={true}
                        />
                    </mesh>
                )}
            </mesh>

            <Html
                position={[0, size * 1.5, 0]}
                center
                style={{
                    pointerEvents: "none",
                    opacity: selected || hovered ? 1 : 0.8,
                    transform: `scale(${(selected ? 1.2 : 1.0) * labelScale})`,
                    transition: "opacity 0.2s, transform 0.2s",
                }}
            >
                <div
                    style={{
                        background: `rgba(30,30,30,${labelBgOpacity})`,
                        color: "white",
                        padding: "2px 4px",
                        borderRadius: "2px",
                        fontSize: `${10 * labelScale}px`,
                        whiteSpace: "nowrap",
                        maxWidth: `${150 * labelScale}px`,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
                    }}
                >
                    {displayLabel}
                    {similarity && (
                        <span style={{ color: "#aaffaa" }}>
                            {" "}
                            ({similarity})
                        </span>
                    )}
                </div>
            </Html>
        </group>
    )
}

// Connection lines between points
const ConnectionLines = ({
    points,
    threshold = 0.8,
    maxConnections = 3,
}: {
    points: { position: [number, number, number]; vector: number[] }[]
    threshold?: number
    maxConnections?: number
}) => {
    // Calculate cosine similarity between vectors
    const similarities: { i: number; j: number; similarity: number }[] = []

    for (let i = 0; i < points.length; i++) {
        const connections: { j: number; similarity: number }[] = []

        for (let j = i + 1; j < points.length; j++) {
            const v1 = points[i].vector
            const v2 = points[j].vector

            // Cosine similarity
            const dotProduct = v1.reduce(
                (sum, val, idx) => sum + val * v2[idx],
                0
            )
            const mag1 = Math.sqrt(v1.reduce((sum, val) => sum + val * val, 0))
            const mag2 = Math.sqrt(v2.reduce((sum, val) => sum + val * val, 0))
            const similarity = dotProduct / (mag1 * mag2) || 0

            if (similarity > threshold) {
                connections.push({ j, similarity })
            }
        }

        // Sort by similarity and take top maxConnections
        connections
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, maxConnections)
            .forEach((conn) => {
                similarities.push({ i, j: conn.j, similarity: conn.similarity })
            })
    }

    return (
        <group>
            {similarities.map((sim, idx) => {
                const start = points[sim.i].position
                const end = points[sim.j].position
                const opacity = Math.min(
                    1,
                    (sim.similarity - threshold) / (1 - threshold)
                )

                return (
                    <line
                        key={`line-${sim.i}-${sim.j}-${sim.similarity.toFixed(
                            3
                        )}`}
                    >
                        <bufferGeometry attach="geometry">
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={new Float32Array([...start, ...end])}
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial
                            attach="material"
                            color="#555555"
                            transparent={true}
                            opacity={opacity * 0.5}
                            linewidth={1}
                        />
                    </line>
                )
            })}
        </group>
    )
}

// Camera controls component
const CameraController = ({
    center,
    distance,
    resetTrigger,
}: {
    center: Vector3
    distance: number
    resetTrigger: number
}) => {
    // Use the correct type for OrbitControls
    const controlsRef = useRef<OrbitControlsImpl>(null)
    const { camera } = useThree()

    // Reset camera position when resetTrigger changes
    React.useEffect(() => {
        if (controlsRef.current) {
            // Set target to center
            controlsRef.current.target.copy(center)

            // Position camera at a distance
            const direction = new Vector3(1, 1, 1).normalize()
            const position = direction.multiplyScalar(distance).add(center)
            camera.position.copy(position)

            // Update controls
            controlsRef.current.update()
        }
    }, [center, distance, resetTrigger, camera])

    return (
        <OrbitControls
            ref={controlsRef}
            target={[center.x, center.y, center.z]}
            enableDamping
            dampingFactor={0.05}
        />
    )
}

// Main component
export default function VectorViz3D({
    data,
    onVectorSelect,
}: VectorViz3DProps & {
    onVectorSelect?: (element: string) => void
}) {
    console.log("[DEBUG] Component rendering with data length:", data?.length);

    const [selectedPoint, setSelectedPoint] = React.useState<number | null>(null);
    
    // Add effect to track selectedPoint changes
    React.useEffect(() => {
        console.log("[DEBUG] selectedPoint changed to:", selectedPoint);
    }, [selectedPoint]);

    // Add effect to track data changes
    React.useEffect(() => {
        console.log("[DEBUG] data prop changed, length:", data?.length);
    }, [data]);

    const [pointSize, setPointSize] = useState<number>(0.1)
    const [labelScale, setLabelScale] = useState<number>(1.0)
    const [labelBgOpacity, setLabelBgOpacity] = useState<number>(0.5)
    const [showControls, setShowControls] = useState<boolean>(false)
    const [connectionThreshold, setConnectionThreshold] = useState<number>(0.7)
    const [showAllLabels, setShowAllLabels] = useState<boolean>(true)
    const [zoomLevel, setZoomLevel] = useState<number>(0.6)
    const [cameraResetTrigger, setCameraResetTrigger] = useState<number>(0)
    const [browsing, setBrowsing] = useState<boolean>(false)

    // Filter out invalid data
    const validData = React.useMemo(() => {
        console.log("[DEBUG] Recalculating validData");
        return data.filter(
            (item) =>
                item &&
                item.vector &&
                Array.isArray(item.vector) &&
                item.vector.length > 0
        );
    }, [data]);

    // Extract vectors for dimensionality reduction
    const vectors = React.useMemo(() => {
        console.log("[DEBUG] Recalculating vectors");
        return validData.map((item) => item.vector);
    }, [validData]);

    // Use a ref to store positions so they don't change on re-renders
    const positionsRef = useRef<number[][]>([]);
    const isInitializedRef = useRef<boolean>(false);
    const isProcessingClickRef = useRef<boolean>(false);

    // Calculate positions using useMemo instead of useEffect
    const positions = React.useMemo(() => {
        console.log("[DEBUG] Calculating positions. vectors length:", vectors.length);
        
        // If we already have positions and we're initialized, only recalculate if data changed
        if (isInitializedRef.current && positionsRef.current.length > 0) {
            const dataChanged = vectors.some((vector, idx) => {
                const changed = 
                    !positionsRef.current[idx] ||
                    vector.length !== positionsRef.current[idx].length ||
                    vector.some(
                        (val, i) =>
                            Math.abs(val - positionsRef.current[idx][i]) >
                            0.0001
                    );
                if (changed) {
                    console.log("[DEBUG] Data changed at index:", idx);
                    return true;
                }
                return false;
            });

            if (!dataChanged) {
                console.log("[DEBUG] Using existing positions");
                return positionsRef.current;
            }
        }

        // Calculate new positions
        console.log("[DEBUG] Calculating new positions");
        const newPositions = vectors.length > 0 ? reduceToThreeD(vectors) : [];
        positionsRef.current = newPositions;
        isInitializedRef.current = true;
        return newPositions;
    }, [vectors]);

    // Combine data with positions using the memoized positions
    const pointsData = React.useMemo(() => {
        console.log("[DEBUG] Calculating pointsData");
        return validData.map((item, idx) => ({
            label: item.label,
            vector: item.vector,
            position: (positions[idx] || [0, 0, 0]) as [number, number, number],
            color: getVectorColor(item.vector),
        }));
    }, [validData, positions]);

    // Calculate bounding box using memoized pointsData
    const { center, maxDim } = React.useMemo(() => {
        console.log("[DEBUG] Calculating bounding box");
        const box = new Box3();
        pointsData.forEach((point) => {
            box.expandByPoint(new Vector3(...point.position));
        });

        const center = new Vector3();
        box.getCenter(center);

        const size = new Vector3();
        box.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z) || 5;
        return { center, maxDim };
    }, [pointsData]);

    const cameraDistance = maxDim * 2.5 * zoomLevel;

    // Handle point selection
    const handlePointClick = useCallback(
        (idx: number) => {
            // Prevent double processing
            if (isProcessingClickRef.current) {
                console.log("[DEBUG] Skipping duplicate click");
                return;
            }

            isProcessingClickRef.current = true;
            
            console.log("[DEBUG] Point clicked:", idx);
            console.log("[DEBUG] Current selectedPoint:", selectedPoint);
            console.log("[DEBUG] Current validData length:", validData.length);
            
            // If clicking the same point, deselect it
            if (selectedPoint === idx) {
                console.log("[DEBUG] Deselecting point");
                setSelectedPoint(null);
            } else {
                // Select the point
                console.log("[DEBUG] Selecting new point");
                setSelectedPoint(idx);
            }

            // Reset the processing flag after a short delay
            setTimeout(() => {
                isProcessingClickRef.current = false;
            }, 100);
        },
        [selectedPoint, validData]
    );

    // Add an effect to log state updates
    React.useEffect(() => {
        console.log("[DEBUG] State update - selectedPoint:", selectedPoint);
        console.log("[DEBUG] State update - validData length:", validData.length);
    }, [selectedPoint, validData]);

    // Add the handler function
    const handleSearchSimilar = useCallback(() => {
        if (selectedPoint !== null && selectedPoint < validData.length) {
            console.log("[VectorViz3D] handlePointClick:", selectedPoint)
            
            setBrowsing(true)
            // Call the onVectorSelect callback with the selected vector
            if (onVectorSelect) {
                try {
                    // Make sure we're passing a valid vector
                    onVectorSelect(validData[selectedPoint].label)
                } catch (error) {
                    console.error("Error triggering vector search:", error)
                    setBrowsing(false)
                }
            }
        }
    }, [selectedPoint, validData, onVectorSelect]);

    return (
        <div style={{ width: "100%", height: "500px", position: "relative" }}>
            <Canvas>
                <PerspectiveCamera
                    makeDefault
                    position={[cameraDistance, cameraDistance, cameraDistance]}
                    fov={45}
                />

                <color attach="background" args={["#f5f5f5"]} />

                <ambientLight intensity={0.5} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight
                    position={[-10, -10, -5]}
                    intensity={0.5}
                    color="#5588ff"
                />

                {/* Coordinate axes */}
                <group>
                    <line>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={
                                    new Float32Array([0, 0, 0, maxDim, 0, 0])
                                }
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color="#cc0000" />
                    </line>
                    <line>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={
                                    new Float32Array([0, 0, 0, 0, maxDim, 0])
                                }
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color="#00cc00" />
                    </line>
                    <line>
                        <bufferGeometry>
                            <bufferAttribute
                                attach="attributes-position"
                                count={2}
                                array={
                                    new Float32Array([0, 0, 0, 0, 0, maxDim])
                                }
                                itemSize={3}
                            />
                        </bufferGeometry>
                        <lineBasicMaterial color="#0000cc" />
                    </line>
                </group>

                {/* Connection lines */}
                <ConnectionLines
                    key={`connections-${pointsData.length}-${connectionThreshold}`}
                    points={pointsData}
                    threshold={connectionThreshold}
                    maxConnections={5}
                />

                {/* Vector points */}
                {pointsData.map((point, idx) => (
                    <VectorPoint
                        key={`point-${idx}-${point.vector
                            .join(",")
                            .substring(0, 20)}`}
                        position={point.position}
                        label={point.label}
                        color={point.color}
                        size={pointSize}
                        labelScale={labelScale}
                        labelBgOpacity={labelBgOpacity}
                        selected={selectedPoint === idx || showAllLabels}
                        onClick={() => handlePointClick(idx)}
                    />
                ))}

                {/* Grid and controls */}
                <gridHelper
                    args={[maxDim * 2, 10]}
                    position={[0, -maxDim / 2, 0]}
                    rotation={[0, 0, 0]}
                />
                <CameraController
                    center={center}
                    distance={cameraDistance}
                    resetTrigger={cameraResetTrigger}
                />
            </Canvas>

            {/* Controls panel */}
            <div
                style={{
                    position: "absolute",
                    top: "10px",
                    right: "10px",
                    background: "rgba(255,255,255,0.9)",
                    color: "#333",
                    padding: showControls ? "12px" : "8px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    width: showControls ? "200px" : "auto",
                    transition: "width 0.3s",
                }}
            >
                <div
                    onClick={() => setShowControls(!showControls)}
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: showControls ? "8px" : "0",
                        cursor: "pointer",
                    }}
                >
                    <strong>Display Settings</strong>
                    <span
                        style={{
                            background: "none",
                            border: "none",
                            fontSize: "16px",
                        }}
                    >
                        {showControls ? "−" : "+"}
                    </span>
                </div>

                {showControls && (
                    <>
                        <div style={{ marginBottom: "10px" }}>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "4px",
                                }}
                            >
                                Zoom Level: {zoomLevel.toFixed(1)}x
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={zoomLevel}
                                onChange={(e) =>
                                    setZoomLevel(parseFloat(e.target.value))
                                }
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div style={{ marginBottom: "10px" }}>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "4px",
                                }}
                            >
                                Point Size: {pointSize.toFixed(2)}
                            </label>
                            <input
                                type="range"
                                min="0.01"
                                max="0.2"
                                step="0.01"
                                value={pointSize}
                                onChange={(e) =>
                                    setPointSize(parseFloat(e.target.value))
                                }
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div style={{ marginBottom: "10px" }}>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "4px",
                                }}
                            >
                                Label Size: {labelScale.toFixed(1)}
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="2.0"
                                step="0.1"
                                value={labelScale}
                                onChange={(e) =>
                                    setLabelScale(parseFloat(e.target.value))
                                }
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div style={{ marginBottom: "10px" }}>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "4px",
                                }}
                            >
                                Label Background: {labelBgOpacity.toFixed(1)}
                            </label>
                            <input
                                type="range"
                                min="0.1"
                                max="1.0"
                                step="0.1"
                                value={labelBgOpacity}
                                onChange={(e) =>
                                    setLabelBgOpacity(
                                        parseFloat(e.target.value)
                                    )
                                }
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div style={{ marginBottom: "10px" }}>
                            <label
                                style={{
                                    display: "block",
                                    marginBottom: "4px",
                                }}
                            >
                                Connection Threshold:{" "}
                                {connectionThreshold.toFixed(2)}
                            </label>
                            <input
                                type="range"
                                min="0.5"
                                max="0.95"
                                step="0.05"
                                value={connectionThreshold}
                                onChange={(e) =>
                                    setConnectionThreshold(
                                        parseFloat(e.target.value)
                                    )
                                }
                                style={{ width: "100%" }}
                            />
                        </div>

                        <div style={{ display: "flex", alignItems: "center" }}>
                            <input
                                type="checkbox"
                                id="showAllLabels"
                                checked={showAllLabels}
                                onChange={(e) =>
                                    setShowAllLabels(e.target.checked)
                                }
                                style={{ marginRight: "8px" }}
                            />
                            <label htmlFor="showAllLabels">
                                Show All Labels
                            </label>
                        </div>

                        <div
                            style={{
                                marginTop: "15px",
                                display: "flex",
                                justifyContent: "space-between",
                            }}
                        >
                            <button
                                onClick={() => {
                                    setPointSize(0.15);
                                    setLabelScale(1.0);
                                    setLabelBgOpacity(0.5);
                                    setConnectionThreshold(0.7);
                                    setShowAllLabels(true);
                                    setZoomLevel(0.6);
                                }}
                                style={{
                                    background: "#f0f0f0",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                    flex: "1",
                                    marginRight: "4px",
                                }}
                            >
                                Reset Settings
                            </button>
                            <button
                                onClick={() => setCameraResetTrigger((prev) => prev + 1)}
                                style={{
                                    background: "#f0f0f0",
                                    border: "1px solid #ccc",
                                    borderRadius: "4px",
                                    padding: "4px 8px",
                                    cursor: "pointer",
                                    fontSize: "11px",
                                    flex: "1",
                                    marginLeft: "4px",
                                }}
                            >
                                Reset View
                            </button>
                        </div>
                    </>
                )}
            </div>

            {/* Info panel */}
            <div
                style={{
                    position: "absolute",
                    bottom: "10px",
                    left: "10px",
                    background: "rgba(255,255,255,0.9)",
                    color: "#333",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
            >
                <div>Vectors: {pointsData.length}</div>
                <div>Click on a point to select it</div>
                {selectedPoint !== null &&
                    selectedPoint < pointsData.length && (
                        <>
                            <div>
                                <strong>Selected:</strong>{" "}
                                {pointsData[selectedPoint].label}
                            </div>
                            {browsing ? (
                                <div
                                    style={{
                                        marginTop: "5px",
                                        color: "#4285F4",
                                    }}
                                >
                                    Searching for similar vectors...
                                </div>
                            ) : (
                                onVectorSelect && (
                                    <div>
                                        <div
                                            style={{
                                                fontSize: "11px",
                                                marginTop: "3px",
                                                color: "#666",
                                            }}
                                        >
                                            Click "Search Similar" to find
                                            related vectors
                                        </div>
                                        <button
                                            onClick={handleSearchSimilar}
                                            style={{
                                                marginTop: "5px",
                                                background: "#4285F4",
                                                color: "white",
                                                border: "none",
                                                borderRadius: "4px",
                                                padding: "4px 8px",
                                                cursor: "pointer",
                                                fontSize: "11px",
                                            }}
                                        >
                                            Search Similar
                                        </button>
                                    </div>
                                )
                            )}
                        </>
                    )}
            </div>
        </div>
    )
}
