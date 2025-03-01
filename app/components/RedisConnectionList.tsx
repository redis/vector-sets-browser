import { Button } from "@/components/ui/button"
import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface RedisConnection {
    id: string
    name: string
    host: string
    port: number
    lastConnected: string | null
}

interface RedisConnectionListProps {
    onConnect: (url: string) => Promise<void>
    currentUrl: string | null
    isConnecting?: boolean
    isAddDialogOpen?: boolean
    setIsAddDialogOpen?: (open: boolean) => void
}

const RedisConnectionList = forwardRef<
    { setIsAddDialogOpen: (open: boolean) => void },
    RedisConnectionListProps
>(({
    onConnect,
    currentUrl,
    isConnecting = false,
    isAddDialogOpen: externalIsAddDialogOpen,
    setIsAddDialogOpen: externalSetIsAddDialogOpen
}, ref) => {
    const [recentConnections, setRecentConnections] = useState<RedisConnection[]>([])
    const [internalIsAddDialogOpen, setInternalIsAddDialogOpen] = useState(false)
    const [editingConnection, setEditingConnection] = useState<RedisConnection | null>(null)
    const [newConnection, setNewConnection] = useState<RedisConnection>({
        id: "",
        name: "",
        host: "",
        port: 6379,
        lastConnected: null
    })

    // Use external state if provided, otherwise use internal state
    const isAddDialogOpen = externalIsAddDialogOpen !== undefined ? externalIsAddDialogOpen : internalIsAddDialogOpen
    const setIsAddDialogOpen = externalSetIsAddDialogOpen || setInternalIsAddDialogOpen

    // Expose the setIsAddDialogOpen method to parent components via ref
    useImperativeHandle(ref, () => ({
        setIsAddDialogOpen
    }))

    useEffect(() => {
        // Load recent connections from localStorage
        const saved = localStorage.getItem("recentRedisConnections")
        if (saved) {
            try {
                const connections = JSON.parse(saved)
                // Convert old format to new format if necessary
                const formattedConnections = connections.map((conn: string | RedisConnection) => {
                    if (typeof conn === 'string') {
                        try {
                            const parsedUrl = new URL(conn)
                            return {
                                id: conn,
                                name: parsedUrl.pathname.split("/").pop() || "Redis Server",
                                host: parsedUrl.hostname,
                                port: parseInt(parsedUrl.port) || 6379,
                                lastConnected: null
                            }
                        } catch {
                            return null
                        }
                    }
                    return conn
                }).filter(Boolean)
                setRecentConnections(formattedConnections)
            } catch (e) {
                console.error("Error loading connections:", e)
                setDefaultConnection()
            }
        } else {
            setDefaultConnection()
        }
    }, [])

    const setDefaultConnection = () => {
        const defaultConnections = [{
            id: "redis://localhost:6379",
            name: "Local Redis",
            host: "localhost",
            port: 6379,
            lastConnected: null
        }]
        setRecentConnections(defaultConnections)
        localStorage.setItem("recentRedisConnections", JSON.stringify(defaultConnections))
    }

    const saveConnections = (connections: RedisConnection[]) => {
        setRecentConnections(connections)
        localStorage.setItem("recentRedisConnections", JSON.stringify(connections))
    }

    const handleAddConnection = async () => {
        try {
            if (!newConnection.name || !newConnection.host) {
                toast.error("Please fill in all required fields")
                return
            }

            const url = `redis://${newConnection.host}:${newConnection.port}`
            const connection: RedisConnection = {
                ...newConnection,
                id: url,
                lastConnected: null
            }

            // Try to connect first
            await onConnect(url)

            // If connection successful, add to list
            const updatedConnections = [...recentConnections, connection].slice(-5) // Keep only the 5 most recent
            saveConnections(updatedConnections)
            
            setIsAddDialogOpen(false)
            setNewConnection({
                id: "",
                name: "",
                host: "",
                port: 6379,
                lastConnected: null
            })
            
            toast.success("Connection added successfully")
        } catch (error) {
            toast.error("Failed to add connection")
            console.error("Failed to add connection:", error)
        }
    }

    const handleConnect = async (connection: RedisConnection) => {
        try {
            const url = `redis://${connection.host}:${connection.port}`
            await onConnect(url)
            
            // Update last connected timestamp
            const updatedConnection = {
                ...connection,
                lastConnected: new Date().toISOString()
            }
            const updatedConnections = recentConnections.map(conn => 
                conn.id === connection.id ? updatedConnection : conn
            )
            saveConnections(updatedConnections)
            
            // Removed success toast as it's handled by the parent component
        } catch (error) {
            toast.error("Failed to connect")
            console.error("Failed to connect:", error)
        }
    }

    const handleDelete = (connection: RedisConnection) => {
        const updatedConnections = recentConnections.filter(conn => conn.id !== connection.id)
        saveConnections(updatedConnections)
        toast.success("Connection deleted")
    }

    const handleEdit = (connection: RedisConnection) => {
        setEditingConnection({...connection})
    }

    const saveEdit = () => {
        if (!editingConnection) return

        const updatedConnections = recentConnections.map(conn => 
            conn.id === editingConnection.id ? {
                ...editingConnection,
                id: `redis://${editingConnection.host}:${editingConnection.port}`
            } : conn
        )
        saveConnections(updatedConnections)
        setEditingConnection(null)
        toast.success("Connection updated")
    }

    const formatLastConnected = (timestamp: string | null) => {
        if (!timestamp) return 'Never'
        const date = new Date(timestamp)
        const now = new Date()
        const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
        
        if (diffInMinutes < 1) return 'Just now'
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`
        
        const diffInHours = Math.floor(diffInMinutes / 60)
        if (diffInHours < 24) return `${diffInHours}h ago`
        
        const diffInDays = Math.floor(diffInHours / 24)
        if (diffInDays < 7) return `${diffInDays}d ago`
        
        return date.toLocaleDateString()
    }

    return (
        <div className="p-4 flex flex-col">
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4 ">
                    <h2 className="texg-black font-bold text-2xl">
                        Connect to Redis
                    </h2>
                    <Button
                        variant="default"
                        onClick={() => setIsAddDialogOpen(true)}
                        title="Add Connection"
                        className="p-2"
                        disabled={isConnecting}
                    >
                        <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 4v16m8-8H4"
                            />
                        </svg>
                        Add Server
                    </Button>
                </div>

                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add Redis Server</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="name">Name</Label>
                                <Input
                                    id="name"
                                    value={newConnection.name}
                                    onChange={(e) => setNewConnection({
                                        ...newConnection,
                                        name: e.target.value
                                    })}
                                    placeholder="My Redis Server"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="host">Host</Label>
                                <Input
                                    id="host"
                                    value={newConnection.host}
                                    onChange={(e) => setNewConnection({
                                        ...newConnection,
                                        host: e.target.value
                                    })}
                                    placeholder="localhost"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="port">Port</Label>
                                <Input
                                    id="port"
                                    type="number"
                                    value={newConnection.port}
                                    onChange={(e) => setNewConnection({
                                        ...newConnection,
                                        port: parseInt(e.target.value) || 6379
                                    })}
                                    placeholder="6379"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleAddConnection} disabled={isConnecting}>
                                {isConnecting ? 'Connecting...' : 'Connect'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {recentConnections.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] bg-white rounded-lg border border-dashed border-gray-300 p-8">
                        <div className="text-center space-y-4">
                            <h3 className="text-lg font-medium text-gray-900">
                                Welcome to VectorSet Browser
                            </h3>
                            <p className="text-sm text-gray-500 max-w-sm">
                                Add your first Redis connection to get started.
                                You can connect to a local Redis instance or a
                                remote server.
                            </p>
                            <Button
                                onClick={() => setIsAddDialogOpen(true)}
                                className="mt-4"
                                size="lg"
                            >
                                <svg
                                    className="w-5 h-5 mr-2"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                                Add Redis Connection
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="w-full list-container bg-white">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-gray-100">
                                    <TableHead>Name</TableHead>
                                    <TableHead>Host</TableHead>
                                    <TableHead>Port</TableHead>
                                    <TableHead>Last Connected</TableHead>
                                    <TableHead className="text-right">
                                        Actions
                                    </TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentConnections.map((connection) => (
                                    <TableRow
                                        key={connection.id}
                                        className={`group hover:bg-gray-50 border-b transition-colors ${
                                            currentUrl === connection.id
                                                ? "bg-gray-200 border-l-4 border-l-customRed-500"
                                                : ""
                                        }`}
                                    >
                                        {editingConnection?.id ===
                                        connection.id ? (
                                            <>
                                                <TableCell>
                                                    <Input
                                                        value={
                                                            editingConnection.name
                                                        }
                                                        onChange={(e) =>
                                                            setEditingConnection({
                                                                ...editingConnection,
                                                                name: e.target.value,
                                                            })
                                                        }
                                                        className="w-full"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={
                                                            editingConnection.host
                                                        }
                                                        onChange={(e) =>
                                                            setEditingConnection({
                                                                ...editingConnection,
                                                                host: e.target.value,
                                                            })
                                                        }
                                                        className="w-full"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        value={
                                                            editingConnection.port
                                                        }
                                                        onChange={(e) =>
                                                            setEditingConnection({
                                                                ...editingConnection,
                                                                port: parseInt(
                                                                    e.target.value
                                                                ) || 6379,
                                                            })
                                                        }
                                                        className="w-full"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {formatLastConnected(
                                                        connection.lastConnected
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={saveEdit}
                                                        >
                                                            Save
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() =>
                                                                setEditingConnection(
                                                                    null
                                                                )
                                                            }
                                                        >
                                                            Cancel
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        ) : (
                                            <>
                                                <TableCell
                                                    className="font-medium cursor-pointer"
                                                    onClick={() =>
                                                        handleConnect(connection)
                                                    }
                                                >
                                                    {connection.name}
                                                </TableCell>
                                                <TableCell>
                                                    {connection.host}
                                                </TableCell>
                                                <TableCell>
                                                    {connection.port}
                                                </TableCell>
                                                <TableCell>
                                                    {formatLastConnected(
                                                        connection.lastConnected
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() =>
                                                                handleEdit(
                                                                    connection
                                                                )
                                                            }
                                                            disabled={isConnecting}
                                                        >
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-red-600 hover:text-red-800"
                                                            onClick={() =>
                                                                handleDelete(
                                                                    connection
                                                                )
                                                            }
                                                            disabled={isConnecting}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </>
                                        )}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </div>
        </div>
    )
})

export default RedisConnectionList
