import { VectorSetMetadata } from "../types/embedding"

interface VectorSetHeaderProps {
    vectorSetName: string
    recordCount: number | null
    dim: number | null
    metadata: VectorSetMetadata | null
}

export default function VectorSetHeader({ vectorSetName, recordCount, dim, metadata }: VectorSetHeaderProps) {
    return (
        <div className="flex space-x-2 items-center">
            <div className="text-xl">{vectorSetName}</div>
            <div className="grow"></div>
        </div>
    )
} 