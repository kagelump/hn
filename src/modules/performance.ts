// Performance tracking module
import type { PerformanceData } from '../types';

class PerformanceTracker {
  private perfData: PerformanceData = {
    insertedNodeCount: 0
  };

  update(id: string, type: string, time: number): void;
  update(id: string, data: Record<string, string | number>): void;
  update(id: string, typeOrData: string | Record<string, string | number>, time?: number): void {
    if (!this.perfData[id]) {
      this.perfData[id] = {};
    }

    if (typeof typeOrData === 'object') {
      this.perfData[id] = typeOrData;
    } else if (typeof typeOrData === 'string' && time !== undefined) {
      const current = this.perfData[id];
      if (typeof current === 'object' && current !== null) {
        const existing = current[typeOrData];
        current[typeOrData] = existing ? `${existing},${time}` : String(time);
      }
    }
  }

  get data(): PerformanceData {
    return this.perfData;
  }
}

export const perf = new PerformanceTracker();
