import { userSettings } from "@/lib/storage/userSettings"
import { useCallback, useEffect, useRef, useState } from "react"

interface UseSearchOptionsParams {
    initialSearchFilter: string
    vectorSetName: string
    searchQuery: string
    setSearchQuery: (query: string) => void
    setSearchFilter: (filter: string) => void
    forceLinearScan: boolean
    setForceLinearScan: (value: boolean) => void
    noThread: boolean
    setNoThread: (value: boolean) => void
    searchExplorationFactor?: number
    setSearchExplorationFactor?: (value: number | undefined) => void
    filterExplorationFactor?: number
    setFilterExplorationFactor?: (value: number | undefined) => void
}

export default function useSearchOptions({
    initialSearchFilter,
    vectorSetName,
    searchQuery,
    setSearchQuery,
    setSearchFilter,
    forceLinearScan,
    setForceLinearScan,
    noThread,
    setNoThread,
    searchExplorationFactor,
    setSearchExplorationFactor,
    filterExplorationFactor,
    setFilterExplorationFactor,
}: UseSearchOptionsParams) {
    // UI State
    const [showFilters, setShowFilters] = useState(() => {
        return userSettings.get("showFilters") ?? true
    })
    const [showFilterHelp, setShowFilterHelp] = useState(false)
    const [showSearchOptions, setShowSearchOptions] = useState(false)
    const [showRedisCommand, setShowRedisCommand] = useState(() => {
        return userSettings.get("showRedisCommand") ?? true
    })

    // Local state for filters with debounce
    const [localFilter, setLocalFilter] = useState(initialSearchFilter)
    const filterTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    
    // Local state for options
    const [localForceLinearScan, setLocalForceLinearScan] = useState(forceLinearScan)
    const [localNoThread, setLocalNoThread] = useState(noThread)
    
    // State for exploration factors
    const [useCustomEF, setUseCustomEF] = useState(() => {
        return userSettings.get("useCustomEF") ?? false
    })
    const [efValue, setEFValue] = useState(() => {
        return userSettings.get("efValue") ?? "200"
    })
    const [useCustomFilterEF, setUseCustomFilterEF] = useState(() => {
        return userSettings.get("useCustomFilterEF") ?? false
    })
    const [filterEFValue, setFilterEFValue] = useState(() => {
        return userSettings.get("filterEFValue") ?? "100"
    })

    // Update local filter when searchFilter prop changes or vectorset changes
    useEffect(() => {
        setLocalFilter(initialSearchFilter)
    }, [vectorSetName, initialSearchFilter])

    // Handle filter changes with debounce
    const handleFilterChange = (value: string) => {
        setLocalFilter(value)

        if (filterTimeoutRef.current) {
            clearTimeout(filterTimeoutRef.current)
        }

        filterTimeoutRef.current = setTimeout(() => {
            setSearchFilter(value)
        }, 500)
    }

    // Helper to trigger search after option changes
    const triggerSearchAfterOptionChange = useCallback(() => {
        // To ensure we force a search update, we'll add a small character to the end of the query
        // and then immediately restore it.
        const triggerChar = searchQuery.endsWith(" ") ? "x" : " "
        const originalQuery = searchQuery
        
        // Modify the query to force update
        setSearchQuery(originalQuery + triggerChar)
        
        // Restore the original query after a small delay
        setTimeout(() => {
            setSearchQuery(originalQuery)
        }, 500)
    }, [searchQuery, setSearchQuery])

    // Handle exploration factor toggle
    const handleEFToggle = (checked: boolean) => {
        setUseCustomEF(checked)
        
        if (setSearchExplorationFactor) {
            if (checked) {
                const value = parseInt(efValue)
                const efNumber = isNaN(value) ? 200 : value
                setSearchExplorationFactor(efNumber)
            } else {
                setSearchExplorationFactor(undefined)
            }
            triggerSearchAfterOptionChange()
        }
    }
    
    // Handle exploration factor value change
    const handleEFValueChange = (value: string) => {
        if (value === efValue) return
        
        setEFValue(value)
        if (setSearchExplorationFactor && useCustomEF) {
            const numValue = parseInt(value)
            const efNumber = isNaN(numValue) ? 200 : numValue
            setSearchExplorationFactor(efNumber)
            triggerSearchAfterOptionChange()
        }
    }

    // Handle filter exploration factor toggle
    const handleFilterEFToggle = (checked: boolean) => {
        setUseCustomFilterEF(checked)
        
        if (setFilterExplorationFactor) {
            if (checked) {
                const value = parseInt(filterEFValue)
                const efNumber = isNaN(value) ? 100 : value
                setFilterExplorationFactor(efNumber)
            } else {
                setFilterExplorationFactor(undefined)
            }
            triggerSearchAfterOptionChange()
        }
    }

    // Handle filter exploration factor value change
    const handleFilterEFValueChange = (value: string) => {
        if (value === filterEFValue) return
        
        setFilterEFValue(value)
        if (setFilterExplorationFactor && useCustomFilterEF) {
            const numValue = parseInt(value)
            const efNumber = isNaN(numValue) ? 100 : numValue
            setFilterExplorationFactor(efNumber)
            triggerSearchAfterOptionChange()
        }
    }

    // Handle force linear scan toggle
    const handleForceLinearScanToggle = (checked: boolean) => {
        setLocalForceLinearScan(checked)
        setForceLinearScan(checked)
        userSettings.set("forceLinearScan", checked)
        triggerSearchAfterOptionChange()
    }

    // Handle no thread toggle
    const handleNoThreadToggle = (checked: boolean) => {
        setLocalNoThread(checked)
        setNoThread(checked)
        userSettings.set("noThread", checked)
        triggerSearchAfterOptionChange()
    }

    // Handle done button click
    const handleDoneButtonClick = () => {
        triggerSearchAfterOptionChange()
        setShowSearchOptions(false)
    }

    // Clean up timeout on unmount
    useEffect(() => {
        return () => {
            if (filterTimeoutRef.current) {
                clearTimeout(filterTimeoutRef.current)
            }
        }
    }, [])

    // Save settings to localStorage when they change
    useEffect(() => {
        userSettings.set("showFilters", showFilters)
    }, [showFilters])

    useEffect(() => {
        userSettings.set("showRedisCommand", showRedisCommand)
    }, [showRedisCommand])

    useEffect(() => {
        userSettings.set("useCustomEF", useCustomEF)
    }, [useCustomEF])

    useEffect(() => {
        userSettings.set("efValue", efValue)
    }, [efValue])
    
    useEffect(() => {
        userSettings.set("useCustomFilterEF", useCustomFilterEF)
    }, [useCustomFilterEF])
    
    useEffect(() => {
        userSettings.set("filterEFValue", filterEFValue)
    }, [filterEFValue])

    useEffect(() => {
        userSettings.set("forceLinearScan", forceLinearScan)
    }, [forceLinearScan])

    useEffect(() => {
        userSettings.set("noThread", noThread)
    }, [noThread])

    // Initialize props from localStorage on component mount - only runs once
    const isFirstRun = useRef(true)
    useEffect(() => {
        if (!isFirstRun.current) return
        isFirstRun.current = false
        
        // Set initial values for props from localStorage
        if (setSearchExplorationFactor && useCustomEF) {
            const value = parseInt(efValue)
            const efNumber = isNaN(value) ? 200 : value
            setSearchExplorationFactor(efNumber)
        } else if (setSearchExplorationFactor) {
            setSearchExplorationFactor(undefined)
        }

        if (setFilterExplorationFactor && useCustomFilterEF) {
            const value = parseInt(filterEFValue)
            const efNumber = isNaN(value) ? 100 : value
            setFilterExplorationFactor(efNumber)
        } else if (setFilterExplorationFactor) {
            setFilterExplorationFactor(undefined)
        }
        
        // Also ensure forceLinearScan and noThread are initialized from localStorage
        if (setForceLinearScan) {
            const stored = userSettings.get("forceLinearScan") ?? false
            if (stored !== forceLinearScan) {
                setForceLinearScan(stored)
            }
        }
        
        if (setNoThread) {
            const stored = userSettings.get("noThread") ?? false
            if (stored !== noThread) {
                setNoThread(stored)
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    return {
        // UI State
        showFilters,
        setShowFilters,
        showFilterHelp,
        setShowFilterHelp,
        showSearchOptions,
        setShowSearchOptions,
        showRedisCommand,
        setShowRedisCommand,
        
        // Filter state
        localFilter,
        handleFilterChange,
        
        // Option state
        localForceLinearScan,
        handleForceLinearScanToggle,
        localNoThread,
        handleNoThreadToggle,
        
        // EF state
        useCustomEF,
        efValue,
        handleEFToggle,
        handleEFValueChange,
        
        // Filter EF state
        useCustomFilterEF,
        filterEFValue,
        handleFilterEFToggle,
        handleFilterEFValueChange,
        
        // Handlers
        handleDoneButtonClick,
        triggerSearchAfterOptionChange,
    }
} 