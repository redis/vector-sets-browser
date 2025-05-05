import { useState } from 'react'
import { generateFilterQuery } from "@/app/api/openai"

interface UseNaturalLanguageParams {
    availableAttributes: string[]
    onChange: (value: string) => void
    clearError?: () => void
}

export default function useNaturalLanguage({
    availableAttributes,
    onChange,
    clearError
}: UseNaturalLanguageParams) {
    const [nlQuery, setNlQuery] = useState("")
    const [isProcessingNL, setIsProcessingNL] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Process natural language query
    const processNaturalLanguage = async () => {
        if (!nlQuery.trim()) return

        setIsProcessingNL(true)
        setError(null)
        if (clearError) clearError()

        try {
            const result = await generateFilterQuery(
                nlQuery,
                availableAttributes
            )

            // Get the filter query from the result
            const filterQuery = result.filterQuery

            // Validate if the response is a valid filter query (should start with a dot)
            if (!filterQuery.trim().startsWith(".")) {
                // If it's not a valid filter, show it as an error message
                setError(filterQuery)
                onChange("")
            } else {
                // Valid filter query
                onChange(filterQuery)
            }
        } catch (err) {
            setError(
                "Failed to process natural language query. Please try again or use direct syntax."
            )
            console.error(err)
        } finally {
            setIsProcessingNL(false)
        }
    }

    // Clear everything
    const clearNlQuery = () => {
        setNlQuery("")
        setError(null)
        if (clearError) clearError()
    }

    return {
        nlQuery,
        setNlQuery,
        isProcessingNL,
        error,
        setError,
        processNaturalLanguage,
        clearNlQuery
    }
} 