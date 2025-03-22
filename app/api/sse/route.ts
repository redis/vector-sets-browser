import { NextRequest } from 'next/server';

// Set this route to use the Edge Runtime for better SSE support
export const runtime = 'edge';

// Cache collection of connected clients
const connectedClients = new Map<string, ReadableStreamController<Uint8Array>>();

/**
 * Broadcast a message to all connected SSE clients
 */
export function broadcastEvent(eventName: string, data: any) {
  const eventString = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  const encoder = new TextEncoder();
  
  connectedClients.forEach((controller, clientId) => {
    try {
      controller.enqueue(encoder.encode(eventString));
    } catch (error) {
      console.error(`Error sending to client ${clientId}:`, error);
      // Remove failed clients
      connectedClients.delete(clientId);
    }
  });
}

/**
 * Handle GET requests to the SSE endpoint
 */
export async function GET(req: NextRequest) {
  // Generate a unique client ID
  const clientId = Math.random().toString(36).substring(2, 15);
  console.log(`New SSE client connecting: ${clientId}`);
  
  // Create a stream for the SSE connection
  const stream = new ReadableStream({
    start(controller) {
      // Store the controller for this client
      connectedClients.set(clientId, controller);
      
      // Send initial connection event
      const encoder = new TextEncoder();
      const initialMessage = `event: connect\ndata: {"clientId":"${clientId}"}\n\n`;
      controller.enqueue(encoder.encode(initialMessage));
      
      console.log(`SSE client connected: ${clientId}, total clients: ${connectedClients.size}`);
    },
    cancel() {
      // Remove client when connection is closed
      connectedClients.delete(clientId);
      console.log(`SSE client disconnected: ${clientId}, total clients: ${connectedClients.size}`);
    }
  });
  
  // Return the response with appropriate headers for SSE
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Prevent Nginx from buffering the SSE stream
    }
  });
} 