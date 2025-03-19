import { useCallback, useState } from "react"

export function useErrorHandling() {
    const [errorMessage, setErrorMessage] = useState<string | null>(null)

    const handleError = useCallback((message: string) => {
        setErrorMessage(message)
    }, [])

    const clearError = useCallback(() => {
        setErrorMessage(null)
    }, [])

    return { errorMessage, handleError, clearError }
}
