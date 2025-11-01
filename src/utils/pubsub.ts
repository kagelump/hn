// Simple PubSub implementation
type Callback = (...args: unknown[]) => void;

class PubSubService {
  private subscribers: Map<string, Callback[]> = new Map();

  subscribe(event: string, callback: Callback): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, []);
    }
    this.subscribers.get(event)!.push(callback);
  }

  publish(event: string, ...args: unknown[]): void {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(...args));
    }
  }

  unsubscribe(event: string, callback: Callback): void {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
}

export const PubSub = new PubSubService();
