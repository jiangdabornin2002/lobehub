import type { AcceptanceReviewAnnotation } from '@lobechat/types';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useState } from 'react';

import type { VideoClock } from './useVideoClock';

type Rect = AcceptanceReviewAnnotation['rect'];

/** Both discussion and rejection draw against the frame actually on screen. */
export const useVideoRegionGesture = (
  clock: VideoClock,
  onRegion?: (note: { rect: Rect; time: { start: number } }) => void,
) => {
  const [draft, setDraft] = useState<Rect | null>(null);
  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const box = element.getBoundingClientRect();
    const origin = {
      x: (event.clientX - box.left) / box.width,
      y: (event.clientY - box.top) / box.height,
    };
    const wasPlaying = !clock.paused;
    const start = clock.controls.frameTime();
    clock.controls.pause();
    element.setPointerCapture(event.pointerId);
    let current: Rect | null = null;
    const clamp = (value: number) => Math.min(Math.max(value, 0), 1);
    const move = (next: PointerEvent) => {
      const x = clamp((next.clientX - box.left) / box.width);
      const y = clamp((next.clientY - box.top) / box.height);
      current = {
        height: Math.abs(y - origin.y),
        width: Math.abs(x - origin.x),
        x: Math.min(x, origin.x),
        y: Math.min(y, origin.y),
      };
      setDraft(current);
    };
    const clean = () => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', cancel);
      setDraft(null);
    };
    const cancel = () => clean();
    const up = () => {
      clean();
      if (current && current.width > 0.02 && current.height > 0.02)
        onRegion?.({ rect: current, time: { start } });
      else if (!wasPlaying) clock.controls.toggle();
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', cancel);
  };
  return { draft, onPointerDown };
};
