import { describe, it, expect, vi } from 'vitest';
import { PubSub } from '../pubsub';

describe('PubSub', () => {
  it('calls subscriber when event is published', () => {
    const handler = vi.fn();
    PubSub.subscribe('test', handler);
    PubSub.publish('test', 'arg1', 'arg2');
    expect(handler).toHaveBeenCalledWith('arg1', 'arg2');
  });

  it('supports multiple subscribers for the same event', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    PubSub.subscribe('multi', h1);
    PubSub.subscribe('multi', h2);
    PubSub.publish('multi', 42);
    expect(h1).toHaveBeenCalledWith(42);
    expect(h2).toHaveBeenCalledWith(42);
  });

  it('does not call subscribers for other events', () => {
    const handler = vi.fn();
    PubSub.subscribe('foo', handler);
    PubSub.publish('bar');
    expect(handler).not.toHaveBeenCalled();
  });

  it('unsubscribes a specific callback', () => {
    const handler = vi.fn();
    PubSub.subscribe('unsub', handler);
    PubSub.unsubscribe('unsub', handler);
    PubSub.publish('unsub');
    expect(handler).not.toHaveBeenCalled();
  });

  it('does not throw when unsubscribing a callback that was never subscribed', () => {
    expect(() => {
      PubSub.unsubscribe('nope', vi.fn());
    }).not.toThrow();
  });

  it('does not throw when publishing an event with no subscribers', () => {
    expect(() => {
      PubSub.publish('nobody-listens');
    }).not.toThrow();
  });

  it('only removes the specified callback, not others', () => {
    const h1 = vi.fn();
    const h2 = vi.fn();
    PubSub.subscribe('partial', h1);
    PubSub.subscribe('partial', h2);
    PubSub.unsubscribe('partial', h1);
    PubSub.publish('partial');
    expect(h1).not.toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });
});
