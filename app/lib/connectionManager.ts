interface StoredConnection {
    id: string;
    url: string;
    timestamp: number;
}

// Generate a unique connection ID
export function generateConnectionId(): string {
    return crypto.randomUUID();
}

// Store connection details in session storage
export function storeConnection(url: string): string {
    const connection: StoredConnection = {
        id: generateConnectionId(),
        url,
        timestamp: Date.now()
    };
    
    // Get existing connections
    const existingConnections = getStoredConnections();
    
    // Add new connection
    existingConnections.push(connection);
    
    // Store back in session storage
    sessionStorage.setItem('redis_connections', JSON.stringify(existingConnections));
    
    return connection.id;
}

// Get connection details by ID
export function getConnection(id: string): StoredConnection | null {
    const connections = getStoredConnections();
    return connections.find(conn => conn.id === id) || null;
}

// Get all stored connections
export function getStoredConnections(): StoredConnection[] {
    const stored = sessionStorage.getItem('redis_connections');
    if (!stored) return [];
    
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

// Remove a connection
export function removeConnection(id: string): void {
    const connections = getStoredConnections();
    const filtered = connections.filter(conn => conn.id !== id);
    sessionStorage.setItem('redis_connections', JSON.stringify(filtered));
}

// Clean up old connections (older than 24 hours)
export function cleanupOldConnections(): void {
    const connections = getStoredConnections();
    const now = Date.now();
    const filtered = connections.filter(conn => {
        const age = now - conn.timestamp;
        return age < 24 * 60 * 60 * 1000; // 24 hours
    });
    sessionStorage.setItem('redis_connections', JSON.stringify(filtered));
} 