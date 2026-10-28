import { ICommand } from './ICommand';

export type HistoryChangeListener = (canUndo: boolean, canRedo: boolean, lastAction?: string) => void;

export class CommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxHistory: number = 60;
  private listeners: Set<HistoryChangeListener> = new Set();

  execute(command: ICommand): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notify();
  }

  undo(): boolean {
    const command = this.undoStack.pop();
    if (!command) return false;

    command.undo();
    this.redoStack.push(command);
    this.notify();
    return true;
  }

  redo(): boolean {
    const command = this.redoStack.pop();
    if (!command) return false;

    command.execute();
    this.undoStack.push(command);
    this.notify();
    return true;
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  subscribe(listener: HistoryChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.canUndo(), this.canRedo());
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const lastAction = this.undoStack[this.undoStack.length - 1]?.label;
    for (const listener of this.listeners) {
      listener(this.canUndo(), this.canRedo(), lastAction);
    }
  }
}
