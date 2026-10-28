export type ToastType = 'success' | 'warning' | 'error' | 'info';

export class ToastNotification {
  private container: HTMLElement;

  constructor() {
    this.container = document.getElementById('toast-container')!;
  }

  public show(message: string, type: ToastType = 'info', durationMs: number = 3200): void {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'warning') icon = '⚠️';
    if (type === 'error') icon = '❌';

    toast.innerHTML = `
      <span class="toast-icon">${icon}</span>
      <span class="toast-message">${message}</span>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 250);
    }, durationMs);
  }
}
