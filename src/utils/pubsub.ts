// Typed PubSub implementation
type Callback = (...args: unknown[]) => void;

class PubSubService {
  private subscribers = new Map<string, Set<Callback>>();

  subscribe(event: string, callback: Callback): void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(callback);
  }

  publish(event: string, ...args: unknown[]): void {
    const callbacks = this.subscribers.get(event);
    if (callbacks) {
      for (const callback of callbacks) {
        callback(...args);
      }
    }
  }

  unsubscribe(event: string, callback: Callback): void {
    this.subscribers.get(event)?.delete(callback);
  }

  clear(): void {
    this.subscribers.clear();
  }
}

export const PubSub = new PubSubService();
