export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDanger?: boolean;
}

export class ConfirmModal {
  private modalElement: HTMLElement;
  private titleElement: HTMLElement;
  private messageElement: HTMLElement;
  private btnCancel: HTMLButtonElement;
  private btnAccept: HTMLButtonElement;
  private btnClose: HTMLElement;

  private resolvePromise?: (value: boolean) => void;

  constructor() {
    this.modalElement = document.getElementById('modal-confirm')!;
    this.titleElement = document.getElementById('confirm-modal-title')!;
    this.messageElement = document.getElementById('confirm-modal-message')!;
    this.btnCancel = document.getElementById('btn-confirm-cancel') as HTMLButtonElement;
    this.btnAccept = document.getElementById('btn-confirm-accept') as HTMLButtonElement;
    this.btnClose = document.getElementById('btn-close-confirm-modal')!;

    this.bindEvents();
  }

  private bindEvents(): void {
    this.btnCancel.addEventListener('click', () => this.handleAction(false));
    this.btnClose.addEventListener('click', () => this.handleAction(false));
    this.btnAccept.addEventListener('click', () => this.handleAction(true));
  }

  public confirm(options: ConfirmOptions): Promise<boolean> {
    this.titleElement.textContent = options.title;
    this.messageElement.innerHTML = options.message;
    this.btnAccept.textContent = options.confirmLabel || 'Xác nhận';
    this.btnCancel.textContent = options.cancelLabel || 'Hủy bỏ';

    if (options.isDanger) {
      this.btnAccept.className = 'btn btn-danger';
    } else {
      this.btnAccept.className = 'btn btn-primary';
    }

    this.modalElement.style.display = 'flex';

    return new Promise<boolean>((resolve) => {
      this.resolvePromise = resolve;
    });
  }

  private handleAction(confirmed: boolean): void {
    this.modalElement.style.display = 'none';
    if (this.resolvePromise) {
      this.resolvePromise(confirmed);
      this.resolvePromise = undefined;
    }
  }
}
