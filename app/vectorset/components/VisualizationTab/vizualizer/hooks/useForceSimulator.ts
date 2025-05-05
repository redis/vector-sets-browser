// @ts-nocheck
import { useCallback, useEffect, useRef } from "react"
import * as THREE from "three"
import { FORCE_SIMULATION_CONSTANTS } from "../constants"
import { ForceEdge, ForceNode } from "../types"

const {
    REPULSION,
    SPRING_LENGTH,
    SPRING_COEFFICIENT,
    TIMESTEP,
    ITERATIONS_PER_FRAME,
} = FORCE_SIMULATION_CONSTANTS

export function useForceSimulator(
    scene: THREE.Scene | null,
    fitCameraToNodes: () => void
) {
    const nodesRef = useRef<ForceNode[]>([])
    const edgesRef = useRef<ForceEdge[]>([])
    const animationFrameId = useRef<number>(null)

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
        }

        // Adjust camera to fit all nodes after forces are applied
        fitCameraToNodes()
    }, [fitCameraToNodes])

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

                // Update label positions
                nodesRef.current.forEach((node) => {
                    if (node.label) {
                        node.label.position.copy(node.mesh.position)
                        node.label.position.x += 2 // Keep offset consistent
                    }
                })

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
