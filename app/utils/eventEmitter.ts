/**
 * A simple event emitter implementation for application-wide events
 */

type EventCallback = (...args: any[]) => void;

export enum AppEvents {
  VECTOR_SET_UPDATED = "vector_set_updated",
  VECTOR_ADDED = "vector_added",
  VECTOR_DELETED = "vector_deleted",
  VECTORS_IMPORTED = "vectors_imported"
}

class EventEmitter {
  private events: Record<string, EventCallback[]> = {};

  /**
   * Subscribe to an event
   * @param event The event name to subscribe to
   * @param callback The callback to be executed when the event is emitted
   * @returns A function to unsubscribe from the event
   */
  on(event: string, callback: EventCallback): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    
    this.events[event].push(callback);
    
    // Return an unsubscribe function
    return () => {
      this.events[event] = this.events[event].filter(cb => cb !== callback);
      if (this.events[event].length === 0) {
        delete this.events[event];
      }
    };
  }

  /**
   * Emit an event with optional parameters
   * @param event The event name to emit
   * @param args Arguments to pass to the event callbacks
   */
  emit(event: string, ...args: any[]): void {
    if (!this.events[event]) {
      return;
    }
    
    this.events[event].forEach(callback => {
      try {
        callback(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }

  /**
   * Remove all listeners for a specific event
   * @param event The event to clear listeners for
   */
  clearEvent(event: string): void {
    delete this.events[event];
  }

  /**
   * Remove all event listeners
   */
  clearAll(): void {
    this.events = {};
  }
}

// Create a singleton instance that can be imported throughout the app
const eventBus = new EventEmitter();
export default eventBus; 