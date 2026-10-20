'use client';

import { isFullFrameRect } from '@lobechat/const/verify';
import type {
  AcceptanceCommentTime,
  AcceptanceReviewAnnotation,
  VerifyEvidenceChapter,
} from '@lobechat/types';
import { Flexbox, Icon } from '@lobehub/ui';
import { cx } from 'antd-style';
import { Play } from 'lucide-react';
import type { ReactNode, RefObject } from 'react';
import { memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import FloatingCommentAction, { FLOATING_ACTION_HOST } from '../FloatingCommentAction';
import { styles } from './styles';
import { useVideoClock } from './useVideoClock';
import { useVideoRegionGesture } from './useVideoRegionGesture';
import {
  ClaimCaption,
  DraftRegion,
  FrameRegions,
  handlePlaybackKey,
  VideoControlBar,
  VideoLoadError,
} from './VideoChrome';
import { VideoClaimList } from './VideoClaimList';
import { claimsAt, frameOf } from './videoTime';
import { VideoTimeline } from './VideoTimeline';

/** Matches the plain `<video>` this replaces, so rows keep their rhythm. */
const MAX_HEIGHT = 360;

export interface VideoEvidencePlayerHandle {
  /** Pause on a moment; `reveal: false` leaves the page where the reader is. */
  focus: (time: AcceptanceCommentTime, options?: { reveal?: boolean }) => void;
}

/** Something pinned to a moment of the video: a comment, a draft or a reject note. */
export interface VideoMark {
  color?: string;
  comment?: string;
  /** Shared by the timeline pin, the frame region and the caller's list row. */
  key: string;
  /** Numbered marks show the number on the frame; unnumbered ones show their text. */
  label?: number | string;
  rect: AcceptanceReviewAnnotation['rect'];
  /** A comment marks a moment; a reject note from an earlier review may mark a span. */
  time: NonNullable<AcceptanceReviewAnnotation['time']>;
}

interface VideoEvidencePlayerProps {
  /** The mark being read or written: its pin and region are lifted. */
  activeMark?: string;
  /** The evidence description — laid out under the player, at the player's width. */
  caption?: ReactNode;
  chapters?: VerifyEvidenceChapter[];
  /** CSS length capping the frame height; the width follows the video's aspect. */
  frameMaxHeight?: string;
  handleRef?: RefObject<VideoEvidencePlayerHandle | null>;
  initialTime?: number;
  marks?: VideoMark[];
  onComment?: (time: number) => void;
  onMarkClick?: (key: string) => void;
  /** Re-sign the file link before retrying — an expired link never loads. */
  onRefreshSource?: () => Promise<unknown>;
  /** Turns the frame into a drawing surface: a drag circles a region on the frame shown. */
  onRegion?: (note: { rect: AcceptanceReviewAnnotation['rect']; time: { start: number } }) => void;
  src: string;
}

/**
 * A video evidence as a reviewer needs it: speed, frame stepping, the agent's
 * steps and claims on the timeline and captioned over the frame, and earlier
 * notes pinned where they were made. Keys work once the player has focus, so
 * Space never hijacks the page scroll.
 */
export const VideoEvidencePlayer = memo<VideoEvidencePlayerProps>(
  ({
    activeMark,
    caption,
    chapters = [],
    frameMaxHeight = `${MAX_HEIGHT}px`,
    marks = [],
    onRefreshSource,
    src,
    handleRef,
    initialTime = 0,
    onComment,
    onRegion,
    onMarkClick,
  }) => {
    const { t } = useTranslation('verify');
    const rootRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const clock = useVideoClock(videoRef, { src });
    const { controls, duration, paused, size, status, time } = clock;
    const [captions, setCaptions] = useState(true);
    const gesture = useVideoRegionGesture(clock, onRegion);
    const initialSeek = useRef(false);
    const pendingFocus = useRef<number | undefined>(undefined);
    useEffect(() => {
      if (clock.status !== 'ready' || initialSeek.current) return;
      initialSeek.current = true;
      controls.seek(pendingFocus.current ?? initialTime);
    }, [clock.status, controls, initialTime]);
    useImperativeHandle(handleRef, () => ({
      focus: (target, { reveal = true } = {}) => {
        pendingFocus.current = target.start;
        controls.pause();
        if (clock.status === 'ready') controls.seek(target.start);
        // Nearest, not centre: what asked usually sits right under the player.
        if (reveal) rootRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      },
    }));

    const claims = captions ? claimsAt(chapters, time) : [];
    const aspect = size ? size.width / size.height : 16 / 9;
    let hint: string | undefined;
    if (onRegion && !gesture.draft)
      hint = paused
        ? t('acceptance.comments.video.hintPaused', { frame: frameOf(time) })
        : t('acceptance.comments.video.hintPlaying');

    return (
      <Flexbox
        gap={8}
        style={{
          maxWidth: `min(100%, calc(${frameMaxHeight} * ${aspect.toFixed(4)}))`,
          width: '100%',
        }}
      >
        <div {...{ [FLOATING_ACTION_HOST]: true }} style={{ position: 'relative' }}>
          <div
            className={styles.player}
            ref={rootRef}
            tabIndex={0}
            onKeyDown={(event) => {
              if (status === 'ready' && handlePlaybackKey(event, clock)) event.preventDefault();
            }}
          >
            <div className={styles.frame} style={{ aspectRatio: `${aspect}` }}>
              <video playsInline preload={'metadata'} ref={videoRef} src={src} />
              {status === 'ready' && (
                <div
                  className={cx(styles.overlay, onRegion && styles.drawable)}
                  onClick={onRegion ? undefined : controls.toggle}
                  onDoubleClick={() => void rootRef.current?.requestFullscreen?.()}
                  onPointerDown={onRegion ? gesture.onPointerDown : undefined}
                >
                  <FrameRegions
                    active={activeMark}
                    paused={paused}
                    time={time}
                    regions={marks
                      .filter((mark) => !isFullFrameRect(mark.rect))
                      .map((mark) => ({
                        color: mark.color,
                        comment: mark.comment,
                        key: mark.key,
                        label: mark.label,
                        rect: mark.rect,
                        start: mark.time.start,
                      }))}
                  />
                  {gesture.draft && <DraftRegion rect={gesture.draft} />}
                  {hint && <div className={styles.hint}>{hint}</div>}
                  {paused && time < 0.05 && !onRegion && (
                    <div className={styles.centerPlay}>
                      <Icon icon={Play} size={24} />
                    </div>
                  )}
                  {claims.length > 0 && <ClaimCaption claims={claims} />}
                </div>
              )}
              {status === 'error' && (
                <VideoLoadError
                  src={src}
                  onReload={async () => {
                    // A new link re-renders with a new src and loads itself;
                    // the explicit load covers a transient failure on the same one.
                    await onRefreshSource?.();
                    controls.reload();
                  }}
                />
              )}
            </div>
            <div
              className={styles.bar}
              style={status === 'ready' ? undefined : { opacity: 0.4, pointerEvents: 'none' }}
            >
              <VideoTimeline
                activeNoteKey={activeMark}
                chapters={chapters}
                duration={duration}
                src={src}
                time={time}
                notes={marks.map((mark) => ({
                  color: mark.color,
                  comment: mark.comment,
                  end: mark.time.end,
                  key: mark.key,
                  start: mark.time.start,
                }))}
                onSeek={controls.seek}
                onClaimClick={(item) => {
                  controls.pause();
                  controls.seek(item.t);
                  setCaptions(true);
                }}
                onNoteClick={(note) => {
                  controls.pause();
                  controls.seek(note.start);
                  onMarkClick?.(String(note.key));
                }}
              />
              <VideoControlBar
                captions={captions}
                chapters={chapters}
                clock={clock}
                onFullscreen={() => void rootRef.current?.requestFullscreen?.()}
                onToggleCaptions={() => setCaptions((value) => !value)}
              />
            </div>
          </div>
          {onComment && (
            <FloatingCommentAction
              title={t('acceptance.comments.commentMedia')}
              onClick={() => {
                const captured = controls.frameTime();
                controls.pause();
                onComment(captured);
              }}
            />
          )}
        </div>
        {caption}
        <VideoClaimList
          chapters={chapters}
          onSeek={(seconds) => {
            controls.pause();
            controls.seek(seconds);
            setCaptions(true);
          }}
        />
      </Flexbox>
    );
  },
);

VideoEvidencePlayer.displayName = 'AcceptanceVideoEvidencePlayer';
