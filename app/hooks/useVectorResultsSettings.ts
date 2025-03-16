import { useState, useCallback, useEffect, useRef } from "react"
import { userSettings } from "@/app/api/userSettings"

// Create a simple cache to prevent duplicate API calls
const settingsCache: Record<string, any> = {}

export interface ColumnConfig {
    name: string
    visible: boolean
    type: "system" | "attribute" // system columns are Element and Score
}

export function useVectorResultsSettings() {
    // Start with default values, will be overridden by stored settings if available
    const [showAttributes, setShowAttributes] = useState<boolean>(false)
    const [showOnlyFilteredAttributes, setShowOnlyFilteredAttributes] = useState<boolean>(true)
    const [isLoaded, setIsLoaded] = useState<boolean>(false)
    const [attributeColumns, setAttributeColumns] = useState<Record<string, boolean>>({})
    
    // Use a ref to track if settings are being loaded
    const isLoadingRef = useRef(false)

    const loadSettings = useCallback(async () => {
        // Skip if already loading
        if (isLoadingRef.current) return
        
        isLoadingRef.current = true
        
        try {
            // Use Promise.all to fetch all settings in parallel
            const [storedShowAttributes, storedShowOnlyFiltered, storedAttributeColumns] = await Promise.all([
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
                    }),
                
                settingsCache["vectorResults.attributeColumns"] !== undefined
                    ? Promise.resolve(settingsCache["vectorResults.attributeColumns"])
                    : userSettings.get("vectorResults.attributeColumns").then(value => {
                        settingsCache["vectorResults.attributeColumns"] = value;
                        return value;
                    })
            ]);
            
            if (typeof storedShowAttributes === "boolean") {
                setShowAttributes(storedShowAttributes)
            }
            
            if (typeof storedShowOnlyFiltered === "boolean") {
                setShowOnlyFilteredAttributes(storedShowOnlyFiltered)
            }
            
            if (storedAttributeColumns && typeof storedAttributeColumns === "object") {
                setAttributeColumns(storedAttributeColumns)
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

    // Function to update a single attribute column's visibility
    const updateAttributeColumnVisibility = useCallback((columnName: string, visible: boolean) => {
        setAttributeColumns(prev => {
            const newColumns = { ...prev, [columnName]: visible }
            
            // Update cache immediately
            settingsCache["vectorResults.attributeColumns"] = newColumns
            
            // Persist the new value
            userSettings.set("vectorResults.attributeColumns", newColumns)
                .catch(error => console.error("Error saving attribute columns setting:", error))
            
            return newColumns
        })
    }, [])

    // Function to get the visibility state for a column
    const getColumnVisibility = useCallback((columnName: string, defaultValue = true): boolean => {
        // For system columns, always return true unless explicitly set to false
        if (columnName === "element" || columnName === "score") {
            // Allow system columns to be hidden if explicitly set
            return attributeColumns[columnName] !== undefined ? attributeColumns[columnName] : true
        }
        
        // For attribute columns, check the stored settings
        return attributeColumns[columnName] !== undefined ? attributeColumns[columnName] : defaultValue
    }, [attributeColumns])

    // Load settings on mount
    useEffect(() => {
        loadSettings()
    }, [loadSettings])

    return {
        showAttributes,
        setShowAttributes: setAndPersistShowAttributes,
        showOnlyFilteredAttributes,
        setShowOnlyFilteredAttributes: setAndPersistShowOnlyFilteredAttributes,
        attributeColumns,
        updateAttributeColumnVisibility,
        getColumnVisibility,
        isLoaded
    }
} 