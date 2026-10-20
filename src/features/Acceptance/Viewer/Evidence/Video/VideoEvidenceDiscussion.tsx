'use client';

import type { AcceptanceReviewAnnotation, VerifyEvidenceChapter } from '@lobechat/types';
import { Flexbox, Icon } from '@lobehub/ui';
import { Text } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { CheckCircle2, ChevronRight, MessageSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { useOptionalAcceptanceScope } from '../../AcceptanceScope';
import { useCommentAnchor } from '../../Comments/anchor';
import { type EvidenceOverlay, overlayColor } from '../overlay';
import { useVideoThreads, type VideoThread } from './useVideoThreads';
import {
  VideoEvidencePlayer,
  type VideoEvidencePlayerHandle,
  type VideoMark,
} from './VideoEvidencePlayer';
import { formatVideoTime } from './videoTime';

const styles = createStaticStyles(({ css }) => ({
  item: css`
    /* Clear of the sticky review bar when a pin scrolls its thread into view. */
    scroll-margin-block: 96px;
    border-radius: ${cssVar.borderRadius};
    transition: background ${cssVar.motionDurationMid};
  `,
  /** The open item reads as one block: its row and the thread under it. */
  itemOpen: css`
    background: ${cssVar.colorFillQuaternary};
    box-shadow: inset 0 0 0 1px ${cssVar.colorBorderSecondary};
  `,
  row: css`
    cursor: pointer;

    display: flex;
    gap: 8px;
    align-items: center;

    width: 100%;
    min-height: 36px;
    padding-block: 6px;
    padding-inline: 8px;
    border: none;
    border-radius: ${cssVar.borderRadius};

    font-size: 14px;
    color: ${cssVar.colorText};
    text-align: start;

    background: transparent;

    &:hover {
      background: ${cssVar.colorFillTertiary};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimaryBorder};
      outline-offset: -2px;
    }
  `,
  /** The screenshot overlay's numbered disc, in the same colour as the comment's region. */
  badge: css`
    flex: none;

    width: 18px;
    height: 18px;
    border-radius: 50%;

    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    color: ${cssVar.colorTextLightSolid};
    text-align: center;
  `,
  stamp: css`
    flex: none;

    font-family: ${cssVar.fontFamilyCode};
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    color: ${cssVar.colorTextSecondary};
  `,
  author: css`
    overflow: hidden;
    flex: none;

    max-width: 30%;

    font-size: 12px;
    color: ${cssVar.colorTextSecondary};
    text-overflow: ellipsis;
    white-space: nowrap;

    /* A phone row keeps its width for the words; the badge colour still says who. */
    @media (width <= 767px) {
      display: none;
    }
  `,
  excerpt: css`
    overflow: hidden;
    flex: 1;

    min-width: 0;

    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  resolved: css`
    color: ${cssVar.colorTextTertiary};
  `,
  meta: css`
    display: inline-flex;
    flex: none;
    gap: 4px;
    align-items: center;

    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  chevron: css`
    flex: none;
    color: ${cssVar.colorTextTertiary};
    transition: transform ${cssVar.motionDurationMid};

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  chevronOpen: css`
    transform: rotate(90deg);
  `,
  thread: css`
    padding-block: 0 12px;
    padding-inline: 36px 12px;
  `,
}));

/**
 * A video with its discussion. The posted comments sit under the player as an
 * index in timeline order — number, moment, who, the first line — so a reader
 * can scan them without the full threads stacking up below the recording.
 * Opening one pauses on its frame, lifts its region and unfolds the thread with
 * its replies and resolve action; a pin on the timeline opens the same row.
 */
export const VideoEvidenceDiscussion = ({
  evidenceId,
  src,
  caption,
  chapters,
  overlays = [],
  notes = [],
  onComment,
  onRefreshSource,
}: {
  caption?: ReactNode;
  chapters?: VerifyEvidenceChapter[];
  evidenceId: string;
  /** Reject notes from an earlier review of this video. */
  notes?: AcceptanceReviewAnnotation[];
  onComment?: (time: number) => void;
  onRefreshSource?: () => Promise<unknown>;
  overlays?: EvidenceOverlay[];
  src: string;
}) => {
  const { t } = useTranslation('verify');
  const player = useRef<VideoEvidencePlayerHandle>(null);
  const scope = useOptionalAcceptanceScope();
  const anchored = useCommentAnchor(overlays, scope?.embedded);
  const { open, openId, threads, toggle } = useVideoThreads(overlays, anchored, (thread) =>
    player.current?.focus(thread.time),
  );

  // Numbered per video in playing order, so the list counts up the way the
  // timeline reads; the check-wide thread number would start mid-way.
  const marks: VideoMark[] = [
    ...threads.map((item, index) => ({
      color: overlayColor(item),
      comment: item.comment,
      key: item.threadId,
      label: index + 1,
      rect: item.rect,
      time: item.time,
    })),
    ...notes.flatMap((note, index) =>
      note.time
        ? [
            {
              comment: note.comment,
              key: `review-${evidenceId}-${index}`,
              rect: note.rect,
              time: note.time,
            },
          ]
        : [],
    ),
  ];

  // Opening a row keeps the reader on the thread they asked for: the player
  // moves to the moment where it stands, without scrolling the row away (on a
  // phone the two do not fit on one screen).
  const select = (item: VideoThread) => {
    if (toggle(item.threadId)) player.current?.focus(item.time, { reveal: false });
  };

  return (
    <Flexbox gap={12}>
      <VideoEvidencePlayer
        activeMark={openId}
        caption={caption}
        chapters={chapters}
        handleRef={player}
        marks={marks}
        src={src}
        onComment={onComment}
        onRefreshSource={onRefreshSource}
        onMarkClick={(key) => {
          if (!threads.some((item) => item.threadId === key)) return;
          open(key);
          requestAnimationFrame(() =>
            document
              .getElementById(`video-thread-${key}`)
              ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
          );
        }}
      />
      {threads.length > 0 && (
        <Flexbox gap={4}>
          <Text fontSize={12} style={{ paddingInline: 8 }} type={'secondary'}>
            {t('acceptance.comments.video.listTitle', { count: threads.length })}
          </Text>
          {threads.map((item, index) => {
            const isOpen = openId === item.threadId;
            const messages = item.commentIds?.length ?? 1;
            return (
              <div
                className={cx(styles.item, isOpen && styles.itemOpen)}
                id={`video-thread-${item.threadId}`}
                key={item.threadId}
              >
                <button
                  aria-expanded={isOpen}
                  className={styles.row}
                  type={'button'}
                  onClick={() => select(item)}
                >
                  <span className={styles.badge} style={{ background: overlayColor(item) }}>
                    {index + 1}
                  </span>
                  <span className={styles.stamp}>{formatVideoTime(item.time.start)}</span>
                  {/* Open, the thread below names the author and says it in full. */}
                  <span className={styles.author}>{isOpen ? '' : item.authorName}</span>
                  <span className={cx(styles.excerpt, item.resolved && styles.resolved)}>
                    {isOpen ? '' : item.comment}
                  </span>
                  {messages > 1 && (
                    <span
                      className={styles.meta}
                      title={t('acceptance.comments.sectionMessages', { count: messages })}
                    >
                      <Icon icon={MessageSquare} size={12} />
                      {messages}
                    </span>
                  )}
                  {item.resolved && (
                    <span className={styles.meta} title={t('acceptance.comments.resolved')}>
                      <Icon icon={CheckCircle2} size={14} />
                    </span>
                  )}
                  <Icon
                    className={cx(styles.chevron, isOpen && styles.chevronOpen)}
                    icon={ChevronRight}
                    size={14}
                  />
                </button>
                {isOpen && <div className={styles.thread}>{item.panel}</div>}
              </div>
            );
          })}
        </Flexbox>
      )}
    </Flexbox>
  );
};
