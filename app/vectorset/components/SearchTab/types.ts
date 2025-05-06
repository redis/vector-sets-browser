import { VectorTuple } from "@/lib/redis-server/api"
import { ColumnConfig } from "@/app/vectorset/hooks/useVectorResultsSettings"
import { VectorSetMetadata } from "@/lib/types/vectors"

export type SortColumn = "element" | "score" | "none"
export type SortDirection = "asc" | "desc"

export type AttributeCache = {
    [key: string]: string | null
}

export type AttributeValue = string | number | boolean | any[]
export type ParsedAttributes = Record<string, AttributeValue>

export interface FilterField {
    field: string
    expression: string
}

export interface VectorResultsProps {
    results: VectorTuple[]
    onRowClick: (element: string) => void
    onDeleteClick: (e: React.MouseEvent, element: string) => void
    onShowVectorClick: (e: React.MouseEvent, element: string) => void
    onBulkDeleteClick?: (elements: string[]) => void
    searchTime?: string
    keyName: string
    searchFilter?: string
    searchQuery?: string
    onClearFilter?: () => void
    onAddVector?: () => void
    isSearching?: boolean
    isLoading?: boolean
    searchType?: "Vector" | "Element" | "Image"
    changeTab?: (tab: string, options?: { openSampleData?: boolean }) => void
    handleAddVectorWithImage?: (element: string, embedding: number[]) => Promise<void>
    metadata?: VectorSetMetadata | null
}

export interface AttributeColumnsDialogProps {
    isOpen: boolean
    onClose: () => void
    columns: ColumnConfig[]
    onToggleColumn: (columnName: string, visible: boolean) => void
} 