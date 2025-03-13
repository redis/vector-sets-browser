import { useState, useCallback, useEffect, useRef } from "react"
import { userSettings } from "@/app/api/userSettings"

// Create a simple cache to prevent duplicate API calls
const settingsCache: Record<string, any> = {}

export function useVectorResultsSettings() {
    // Start with default values, will be overridden by stored settings if available
    const [showAttributes, setShowAttributes] = useState<boolean>(false)
    const [showOnlyFilteredAttributes, setShowOnlyFilteredAttributes] = useState<boolean>(true)
    const [isLoaded, setIsLoaded] = useState<boolean>(false)
    
    // Use a ref to track if settings are being loaded
    const isLoadingRef = useRef(false)

    const loadSettings = useCallback(async () => {
        // Skip if already loading
        if (isLoadingRef.current) return
        
        isLoadingRef.current = true
        
        try {
            // Use Promise.all to fetch both settings in parallel
            const [storedShowAttributes, storedShowOnlyFiltered] = await Promise.all([
                // Check cache first, then fetch if not in cache
                settingsCache["vectorResults.showAttributes"] !== undefined
                    ? Promise.resolve(settingsCache["vectorResults.showAttributes"])
                    : userSettings.get("vectorResults.showAttributes").then(value => {
                        settingsCache["vectorResults.showAttributes"] = value;
                        return value;
                    }),
                
                settingsCache["vectorResults.showOnlyFilteredAttributes"] !== undefined
                    ? Promise.resolve(settingsCache["vectorResults.showOnlyFilteredAttributes"])
                    : userSettings.get("vectorResults.showOnlyFilteredAttributes").then(value => {
                        settingsCache["vectorResults.showOnlyFilteredAttributes"] = value;
                        return value;
                    })
            ]);
            
            if (typeof storedShowAttributes === "boolean") {
                setShowAttributes(storedShowAttributes)
            }
            
            if (typeof storedShowOnlyFiltered === "boolean") {
                setShowOnlyFilteredAttributes(storedShowOnlyFiltered)
            }
            
            setIsLoaded(true)
        } catch (error) {
            console.error("Error loading vector results settings:", error)
            setIsLoaded(true)
        } finally {
            isLoadingRef.current = false
        }
    }, [])

    // Custom setter that updates state and persists the change
    const setAndPersistShowAttributes = useCallback((value: boolean | ((prevState: boolean) => boolean)) => {
        setShowAttributes(prevValue => {
            // Handle both direct values and updater functions
            const newValue = typeof value === 'function' ? value(prevValue) : value
            
            // Update cache immediately
            settingsCache["vectorResults.showAttributes"] = newValue
            
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
            
            // Update cache immediately
            settingsCache["vectorResults.showOnlyFilteredAttributes"] = newValue
            
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