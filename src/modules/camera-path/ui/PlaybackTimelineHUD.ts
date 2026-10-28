import { PathPlaybackController, PlaybackState } from '../services/PathPlaybackController';
import { CameraPath } from '../types/cameraPath.types';
import { PathTrajectoryEvaluator } from '../services/PathTrajectoryEvaluator';

export class PlaybackTimelineHUD {
  private container: HTMLElement;
  private btnPlayPause: HTMLButtonElement;
  private btnStop: HTMLButtonElement;
  private btnRewind: HTMLButtonElement;
  private btnLoop: HTMLButtonElement;
  private btnReverse: HTMLButtonElement;
  private slider: HTMLInputElement;
  private timeDisplayCurrent: HTMLElement;
  private timeDisplayTotal: HTMLElement;

  private controller: PathPlaybackController;
  private activePath: CameraPath | null = null;
  private evaluator: PathTrajectoryEvaluator | null = null;
  private isUserDraggingSlider: boolean = false;

  constructor(controller: PathPlaybackController) {
    this.controller = controller;

    this.container = document.getElementById('playback-timeline-hud')!;
    this.btnPlayPause = document.getElementById('btn-timeline-play-pause') as HTMLButtonElement;
    this.btnStop = document.getElementById('btn-timeline-stop') as HTMLButtonElement;
    this.btnRewind = document.getElementById('btn-timeline-rewind') as HTMLButtonElement;
    this.btnLoop = document.getElementById('btn-timeline-loop') as HTMLButtonElement;
    this.btnReverse = document.getElementById('btn-timeline-reverse') as HTMLButtonElement;
    this.slider = document.getElementById('timeline-slider') as HTMLInputElement;
    this.timeDisplayCurrent = document.getElementById('time-current')!;
    this.timeDisplayTotal = document.getElementById('time-total')!;

    this.bindEvents();
    this.controller.setCallbacks(
      (progress, currentTime, totalDuration) => {
        if (!this.isUserDraggingSlider) {
          this.slider.value = String(Math.round(progress * 1000));
          this.timeDisplayCurrent.textContent = this.formatSeconds(currentTime);
          this.timeDisplayTotal.textContent = this.formatSeconds(totalDuration);
        }
      },
      (state) => {
        this.updatePlayPauseIcon(state);
      }
    );
  }

  private bindEvents(): void {
    this.btnPlayPause.addEventListener('click', () => {
      const state = this.controller.getState();
      if (state === 'playing') {
        this.controller.pause();
      } else if (state === 'paused') {
        this.controller.resume();
      } else if (this.activePath && this.evaluator) {
        this.controller.play(this.activePath, this.evaluator, parseFloat(this.slider.value) / 1000);
      }
    });

    this.btnStop.addEventListener('click', () => {
      this.controller.stop();
      this.slider.value = '0';
      this.timeDisplayCurrent.textContent = '00:00.0';
    });

    this.btnRewind.addEventListener('click', () => {
      this.controller.seek(0);
      this.slider.value = '0';
      this.timeDisplayCurrent.textContent = '00:00.0';
    });

    this.btnLoop.addEventListener('click', () => {
      const nextLoop = !this.controller.isLoop();
      this.controller.setLoop(nextLoop);
      this.btnLoop.classList.toggle('active', nextLoop);
    });

    this.btnReverse.addEventListener('click', () => {
      const nextRev = !this.controller.isReverse();
      this.controller.setReverse(nextRev);
      this.btnReverse.classList.toggle('active', nextRev);
    });

    this.slider.addEventListener('mousedown', () => {
      this.isUserDraggingSlider = true;
    });

    this.slider.addEventListener('input', () => {
      const progress = parseFloat(this.slider.value) / 1000;
      this.controller.seek(progress);
      if (this.activePath) {
        this.timeDisplayCurrent.textContent = this.formatSeconds(progress * this.activePath.durationSeconds);
      }
    });

    this.slider.addEventListener('mouseup', () => {
      this.isUserDraggingSlider = false;
    });
  }

  public setPathAndEvaluator(path: CameraPath | null, evaluator: PathTrajectoryEvaluator | null): void {
    this.activePath = path;
    this.evaluator = evaluator;

    if (path) {
      this.container.style.display = 'flex';
      this.timeDisplayTotal.textContent = this.formatSeconds(path.durationSeconds);
      this.slider.value = '0';
    } else {
      this.container.style.display = 'none';
      this.controller.stop();
    }
  }

  public setVisible(visible: boolean): void {
    this.container.style.display = visible ? 'flex' : 'none';
  }

  private updatePlayPauseIcon(state: PlaybackState): void {
    const icon = this.btnPlayPause.querySelector('i');
    if (state === 'playing') {
      this.btnPlayPause.innerHTML = '<i data-lucide="pause"></i>';
    } else {
      this.btnPlayPause.innerHTML = '<i data-lucide="play"></i>';
    }
    if ((window as any).lucide) (window as any).lucide.createIcons();
  }

  private formatSeconds(sec: number): string {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(4, '0')}`;
  }
}
