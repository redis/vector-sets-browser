import { useState, useCallback, useEffect } from "react"
import { userSettings } from "@/app/api/userSettings"

export function useVectorResultsSettings() {
    // Start with default values, will be overridden by stored settings if available
    const [showAttributes, setShowAttributes] = useState<boolean>(false)
    const [showOnlyFilteredAttributes, setShowOnlyFilteredAttributes] = useState<boolean>(true)
    const [isLoaded, setIsLoaded] = useState<boolean>(false)

    const loadSettings = useCallback(async () => {
        try {
            const storedShowAttributes = await userSettings.get("vectorResults.showAttributes")
            
            if (typeof storedShowAttributes === "boolean") {
                setShowAttributes(storedShowAttributes)
            }

            const storedShowOnlyFiltered = await userSettings.get("vectorResults.showOnlyFilteredAttributes")
            
            if (typeof storedShowOnlyFiltered === "boolean") {
                setShowOnlyFilteredAttributes(storedShowOnlyFiltered)
            }
            
            setIsLoaded(true)
        } catch (error) {
            console.error("Error loading vector results settings:", error)
            setIsLoaded(true)
        }
    }, [])

    // Custom setter that updates state and persists the change
    const setAndPersistShowAttributes = useCallback((value: boolean | ((prevState: boolean) => boolean)) => {
        setShowAttributes(prevValue => {
            // Handle both direct values and updater functions
            const newValue = typeof value === 'function' ? value(prevValue) : value
            
            // Persist the new value
            userSettings.set("vectorResults.showAttributes", newValue)
                .catch(error => console.error("Error saving show attributes setting:", error))
            
            return newValue
        })
    }, [])

    // Custom setter that updates state and persists the change
    const setAndPersistShowOnlyFilteredAttributes = useCallback((value: boolean | ((prevState: boolean) => boolean)) => {
        setShowOnlyFilteredAttributes(prevValue => {
            // Handle both direct values and updater functions
            const newValue = typeof value === 'function' ? value(prevValue) : value
            
            // Persist the new value
            userSettings.set("vectorResults.showOnlyFilteredAttributes", newValue)
                .catch(error => console.error("Error saving show only filtered setting:", error))
            
            return newValue
        })
    }, [])

    // Load settings on mount
    useEffect(() => {
        loadSettings()
    }, [loadSettings])

    return {
        showAttributes,
        setShowAttributes: setAndPersistShowAttributes,
        showOnlyFilteredAttributes,
        setShowOnlyFilteredAttributes: setAndPersistShowOnlyFilteredAttributes,
        isLoaded
    }
} 