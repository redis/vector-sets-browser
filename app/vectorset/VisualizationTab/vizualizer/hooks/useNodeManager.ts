import { useCallback, useState } from "react"
import { toast } from "sonner"
import { SimilarityItem } from "../types"

interface FetchNeighborsResponse {
    success: boolean
    result: SimilarityItem[]
    error?: string
}

export function useNodeManager(
    maxNodes: number,
    getNeighbors: (
        element: string,
        count: number,
        withEmbeddings?: boolean
    ) => Promise<SimilarityItem[]>
) {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const fetchNeighbors = useCallback(
        async (element: string): Promise<FetchNeighborsResponse> => {
            try {
                if (!element) {
                    const error = "No element provided"
                    setErrorMessage(error)
                    return { success: false, result: [], error }
                }

                const response = await getNeighbors(element, maxNodes, true)

                if (!Array.isArray(response)) {
                    const error = "Invalid response format from getNeighbors"
                    setErrorMessage(error)
                    return { success: false, result: [], error }
                }

                // Clear any previous error
                setErrorMessage(null)

                return {
                    success: true,
                    result: response,
                }
            } catch (error) {
                console.error("Error fetching neighbors:", error)
                const errorMsg =
                    error instanceof Error
                        ? error.message
                        : "Failed to fetch neighbors"
                setErrorMessage(errorMsg)
                toast.error(errorMsg)
                return {
                    success: false,
                    result: [],
                    error: errorMsg,
                }
            }
        },
        [maxNodes, getNeighbors]
    )

    return { errorMessage, fetchNeighbors }
}
