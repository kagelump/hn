// Performance tracking module
import type { PerformanceData } from '../types';

class PerformanceTracker {
  private perfData: PerformanceData = {
    insertedNodeCount: 0
  };

  update(id: string, type: string | Record<string, any>, time?: number): void {
    if (!this.perfData[id]) {
      this.perfData[id] = {};
    }

    if (arguments.length === 2 && typeof type === 'object') {
      this.perfData[id] = type;
    } else if (typeof type === 'string' && time !== undefined) {
      const current = this.perfData[id];
      if (typeof current === 'object' && current !== null) {
        const existing = current[type];
        current[type] = existing ? `${existing},${time}` : String(time);
      }
    }
  }

  get data(): PerformanceData {
    return this.perfData;
  }
}

export const perf = new PerformanceTracker();
