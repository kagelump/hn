// UI Loading indicator module

class LoadingIndicator {
  private node: HTMLElement | null;
  private statusNode: HTMLElement | null;
  private readonly CLASS_SHOW_LOADING = 'show-loading';

  constructor() {
    this.node = document.getElementById('loading');
    this.statusNode = document.getElementById('loading-status');
  }

  hide(): void {
    if (this.node) {
      this.node.className = '';
    }
    this.clearStatus();
  }

  show(): void {
    if (this.node) {
      this.node.className = this.CLASS_SHOW_LOADING;
    }
  }

  setStatus(text: string): void {
    if (this.statusNode) {
      this.statusNode.textContent = text;
      this.statusNode.style.display = text ? 'block' : 'none';
    }
  }

  clearStatus(): void {
    if (this.statusNode) {
      this.statusNode.textContent = '';
      this.statusNode.style.display = 'none';
    }
  }

  isVisible(): boolean {
    return this.node?.className === this.CLASS_SHOW_LOADING || false;
  }
}

export const loading = new LoadingIndicator();
