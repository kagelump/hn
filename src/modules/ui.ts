// UI Loading indicator module

class LoadingIndicator {
  private node: HTMLElement | null;
  private readonly CLASS_SHOW_LOADING = 'show-loading';

  constructor() {
    this.node = document.getElementById('loading');
  }

  hide(): void {
    if (this.node) {
      this.node.className = '';
    }
  }

  show(x: number, y: number): void {
    if (this.node) {
      this.node.setAttribute('style', `top: ${y}px; left: ${x}px;`);
      this.node.className = this.CLASS_SHOW_LOADING;
    }
  }

  isVisible(): boolean {
    return this.node?.className === this.CLASS_SHOW_LOADING || false;
  }
}

export const loading = new LoadingIndicator();
