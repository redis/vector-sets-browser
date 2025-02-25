import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

interface Vector {
    id: string
    values: number[]
    similarity?: number
}

interface VectorListProps {
    vectors: Vector[]
    searchResults: Vector[]
}

export default function VectorList({
    vectors,
    searchResults,
}: VectorListProps) {
    const displayVectors = searchResults.length > 0 ? searchResults : vectors

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Values</TableHead>
                    {searchResults.length > 0 && (
                        <TableHead>Similarity</TableHead>
                    )}
                </TableRow>
            </TableHeader>
            <TableBody>
                {displayVectors.map((vector) => (
                    <TableRow key={vector.id}>
                        <TableCell>{vector.id}</TableCell>
                        <TableCell>
                            {vector.values.slice(0, 5).join(", ")}...
                        </TableCell>
                        {searchResults.length > 0 && (
                            <TableCell>
                                {vector.similarity?.toFixed(4)}
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    )
}
