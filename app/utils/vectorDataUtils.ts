import { THREE } from 'three'
import { VLinkResponse, VembResponse } from '../types/vector'

export const vectorDataUtils = {
    batchNodes: (nodes: THREE.Mesh[], batchSize: number = 5) => {
        const batches = []
        for (let i = 0; i < nodes.length; i += batchSize) {
            batches.push(nodes.slice(i, i + batchSize))
        }
        return batches
    },

    createVectorCache: () => {
        return (window as any).vectorCache || new Map<string, number[]>()
    }
}

export class VectorDataService {
    private vectorCache: Map<string, number[]>

    constructor(
        private getNeighbors: (element: string) => Promise<VLinkResponse>,
        private getVectors: (elements: string[]) => Promise<VembResponse>
    ) {
        this.vectorCache = vectorDataUtils.createVectorCache()
        ;(window as any).vectorCache = this.vectorCache
    }

    async fetchNeighbors(element: string): Promise<VLinkResponse> {
        if (!element) {
            throw new Error("Element is undefined")
        }
        return await this.getNeighbors(element)
    }

    async fetchVectorsForNodes(nodes: THREE.Mesh[]): Promise<Map<THREE.Mesh, number[]>> {
        const vectorMap = new Map<THREE.Mesh, number[]>()
        const batches = vectorDataUtils.batchNodes(nodes)

        for (const batch of batches) {
            const elements = batch.map(node => node.userData.element)
            try {
                const response = await this.getVectors(elements)
                if (response.success) {
                    batch.forEach(node => {
                        const vector = response.result[node.userData.element]
                        if (vector) {
                            vectorMap.set(node, vector)
                            this.vectorCache.set(node.userData.element, vector)
                        }
                    })
                }
            } catch (error) {
                console.error("Error fetching vectors for batch:", error)
            }

            if (batches.length > 1) {
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
        }

        return vectorMap
    }
} 