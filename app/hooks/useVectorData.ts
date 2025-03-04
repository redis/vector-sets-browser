import { useCallback, useMemo } from 'react'
import { THREE } from 'three'
import { VLinkResponse, VembResponse } from '../types/vector'
import { VectorDataService } from '../utils/vectorDataUtils'
import { useErrorHandling } from './useErrorHandling'

export function useVectorData(
    getNeighbors: (element: string) => Promise<VLinkResponse>,
    getVectors: (elements: string[]) => Promise<VembResponse>
) {
    const { errorMessage, handleError, clearError } = useErrorHandling()
    
    const vectorService = useMemo(() => 
        new VectorDataService(getNeighbors, getVectors),
        [getNeighbors, getVectors]
    )

    const fetchNeighbors = useCallback(async (element: string) => {
        try {
            clearError()
            return await vectorService.fetchNeighbors(element)
        } catch (error) {
            handleError("Error fetching neighbors")
            return { success: false, result: [] }
        }
    }, [vectorService, handleError, clearError])

    const getVectorsForNodes = useCallback(async (nodes: THREE.Mesh[]) => {
        try {
            clearError()
            return await vectorService.fetchVectorsForNodes(nodes)
        } catch (error) {
            handleError("Error fetching vectors")
            return new Map()
        }
    }, [vectorService, handleError, clearError])

    return {
        errorMessage,
        fetchNeighbors,
        getVectorsForNodes
    }
} 