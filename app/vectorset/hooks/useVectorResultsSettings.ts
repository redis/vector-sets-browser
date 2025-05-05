import { userSettings } from "@/lib/storage/userSettings"
import { useCallback, useEffect, useRef, useState } from "react"

export interface ColumnConfig {
    name: string
    visible: boolean
    type: "system" | "attribute" // system columns are Element and Score
}

export function useVectorResultsSettings() {
    // Start with default values, will be overridden by stored settings if available
    const [showAttributes, setShowAttributes] = useState<boolean>(false)
    const [showOnlyFilteredAttributes, setShowOnlyFilteredAttributes] =
        useState<boolean>(true)
    const [isLoaded, setIsLoaded] = useState<boolean>(false)
    const [attributeColumns, setAttributeColumns] = useState<
        Record<string, boolean>
    >({})

    // Use a ref to track if settings are being loaded
    const isLoadingRef = useRef(false)

    const loadSettings = useCallback(async () => {
        // Skip if already loading
        if (isLoadingRef.current) return

        isLoadingRef.current = true

        setShowAttributes(userSettings.get("vectorResults.showAttributes") || false)

        setShowOnlyFilteredAttributes(userSettings.get("vectorResults.showOnlyFilteredAttributes") || false)

        setAttributeColumns(userSettings.get("vectorResults.attributeColumns") || {})

        setIsLoaded(true)
    }, [])

    // Custom setter that updates state and persists the change
    const setAndPersistShowAttributes = useCallback(
        (value: boolean | ((prevState: boolean) => boolean)) => {
            setShowAttributes((prevValue) => {
                // Handle both direct values and updater functions
                const newValue =
                    typeof value === "function" ? value(prevValue) : value

                // Persist the new value
                userSettings
                    .set("vectorResults.showAttributes", newValue)
                    
                return newValue
            })
        },
        []
    )

    // Custom setter that updates state and persists the change
    const setAndPersistShowOnlyFilteredAttributes = useCallback(
        (value: boolean | ((prevState: boolean) => boolean)) => {
            setShowOnlyFilteredAttributes((prevValue) => {
                // Handle both direct values and updater functions
                const newValue =
                    typeof value === "function" ? value(prevValue) : value

                // Persist the new value
                userSettings
                    .set("vectorResults.showOnlyFilteredAttributes", newValue)

                return newValue
            })
        },
        []
    )

    // Function to update a single attribute column's visibility
    const updateAttributeColumnVisibility = useCallback(
        (columnName: string, visible: boolean) => {
            setAttributeColumns((prev) => {
                const newColumns = { ...prev, [columnName]: visible }

                // Persist the new value
                userSettings
                    .set("vectorResults.attributeColumns", newColumns)

                return newColumns
            })
        },
        []
    )

    // Function to get the visibility state for a column
    const getColumnVisibility = useCallback(
        (columnName: string, defaultValue = true): boolean => {
            // For system columns, always return true unless explicitly set to false
            if (columnName === "element" || columnName === "score") {
                // Allow system columns to be hidden if explicitly set
                return attributeColumns[columnName] !== undefined
                    ? attributeColumns[columnName]
                    : true
            }

            // For attribute columns, check the stored settings
            return attributeColumns[columnName] !== undefined
                ? attributeColumns[columnName]
                : defaultValue
        },
        [attributeColumns]
    )

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
        isLoaded,
    }
}
