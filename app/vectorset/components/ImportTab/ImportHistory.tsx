import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type ImportLogEntry } from "@/app/api/jobs"

// Helper function to format dates nicely
const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    })
}

interface ImportHistoryProps {
    importLogs: ImportLogEntry[]
}

export default function ImportHistory({ importLogs }: ImportHistoryProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Import History</CardTitle>
            </CardHeader>
            <CardContent>
                {importLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        No import history available.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {importLogs.map((log) => (
                            <Card key={log.jobId} className="p-3">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <p className="font-medium">
                                            {log.filename}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            {formatDate(log.timestamp)}
                                        </p>
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                        {log.recordsProcessed} records
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
} 