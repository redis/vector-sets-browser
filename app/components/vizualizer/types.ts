import * as THREE from "three"

export interface VLinkResponse {
    success: boolean
    result: Array<[string, number, number[]]>  // Array of levels, each containing array of [element, similarity, vector]
}

export interface VembResponse {
    success: boolean
    result: number[]
}

export interface ForceNode {
    mesh: THREE.Mesh
    velocity: THREE.Vector2
    force: THREE.Vector2
    vector: number[] | undefined
}

export interface ForceEdge {
    source: ForceNode
    target: ForceNode
    line: THREE.Line
    strength: number
    isParentChild?: boolean
}

export interface SimilarityItem {
    element: string
    similarity: number
    vector: number[]
}
