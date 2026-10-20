'use client';

import { Center, Flexbox, Icon } from '@lobehub/ui';
import { ActionIcon, Button, Text, TextArea } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar, cx } from 'antd-style';
import { SquareDashedMousePointer, Trash2 } from 'lucide-react';
import type { ReactNode, Ref } from 'react';
import { useTranslation } from 'react-i18next';

/** The point where the side panel folds under the stage, matching the modal shell. */
const PHONE = '@media (width <= 767px)';

const styles = createStaticStyles(({ css }) => ({
  root: css`
    display: flex;
    flex: 1;
    flex-direction: column;

    min-width: 0;
    min-height: 0;
  `,
  /** Stage and notes side by side: the hand that circles is the hand that types. */
  body: css`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 352px;
    flex: 1;
    min-height: 0;

    ${PHONE} {
      overflow-y: auto;
      overscroll-behavior: contain;
      display: flex;
      flex-direction: column;
      gap: 16px;

      padding-block-end: 16px;
    }
  `,
  /** A tinted canvas: the room around the evidence reads as stage, not as empty dialog. */
  stage: css`
    display: flex;
    flex-direction: column;
    gap: 12px;

    min-width: 0;
    min-height: 0;
    padding: 16px;

    background: ${cssVar.colorBgLayout};

    /* In the phone's single scroll, a shrinking stage would slide under the notes. */
    ${PHONE} {
      flex: none;
      padding-block: 12px 0;
      padding-inline: 12px;
      background: none;
    }
  `,
  /**
   * A size container, so the video can fit its frame to the room left over
   * (100cqh) instead of a guessed constant. A phone stacks, so there the
   * box takes its content's height.
   */
  fit: css`
    container-type: size;
    display: flex;
    flex: 1;
    align-items: center;
    justify-content: center;

    min-height: 0;

    ${PHONE} {
      container-type: normal;
      flex: none;
    }
  `,
  scroll: css`
    overflow: auto;
    flex: 1;
    min-height: 0;

    ${PHONE} {
      flex: none;
    }
  `,
  panel: css`
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 8px;

    min-height: 0;
    padding: 16px;
    border-inline-start: 1px solid ${cssVar.colorBorderSecondary};

    ${PHONE} {
      overflow: visible;
      flex: none;

      padding-block: 0;
      padding-inline: 12px;
      border: none;
    }
  `,
  footer: css`
    display: flex;
    flex: none;
    gap: 12px;
    align-items: center;

    padding-block: 12px;
    padding-inline: 16px;
    border-block-start: 1px solid ${cssVar.colorBorderSecondary};

    ${PHONE} {
      flex-direction: column;
      gap: 8px;
      align-items: stretch;

      padding-block: 12px max(12px, env(safe-area-inset-bottom));
      padding-inline: 12px;

      > button {
        min-height: 44px;
      }
    }
  `,
  status: css`
    flex: 1;
    min-width: 0;
    font-size: 12px;
    color: ${cssVar.colorTextTertiary};
  `,
  statusError: css`
    color: ${cssVar.colorError};
  `,
  cancel: css`
    ${PHONE} {
      display: none;
    }
  `,
  note: css`
    display: flex;
    flex-direction: column;
    gap: 8px;

    padding: 12px;
    border: 1px solid transparent;
    border-radius: ${cssVar.borderRadiusLG};

    transition:
      background ${cssVar.motionDurationMid},
      border-color ${cssVar.motionDurationMid};

    ${PHONE} {
      padding-inline: 8px;

      textarea {
        font-size: 16px;
      }
    }

    /* Touch leaves :hover on the last tapped card; only a pointer earns the wash. */
    @media (hover: hover) {
      &:hover {
        background: ${cssVar.colorFillTertiary};
      }
    }

    @media (prefers-reduced-motion: reduce) {
      transition: none;
    }
  `,
  noteActive: css`
    border-color: ${cssVar.colorBorder};
    background: ${cssVar.colorBgContainer};
    box-shadow: ${cssVar.boxShadowTertiary};

    @media (hover: hover) {
      &:hover {
        background: ${cssVar.colorBgContainer};
      }
    }
  `,
  statusLink: css`
    cursor: pointer;

    padding: 0;
    border: none;

    font: inherit;
    color: ${cssVar.colorText};
    text-decoration: underline;
    text-underline-offset: 3px;

    background: none;

    &:hover {
      color: ${cssVar.colorPrimaryHover};
    }

    &:focus-visible {
      border-radius: 2px;
      outline: 2px solid ${cssVar.colorPrimaryBorder};
    }
  `,
  /**
   * Ties the note to the numbered region on the picture: the same red disc the
   * screenshot editor draws on the region and the reject panel puts by its note.
   */
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

    background: ${cssVar.colorError};
  `,
  empty: css`
    flex: 1;
    gap: 8px;

    min-height: 200px;
    padding-block: 32px;
    padding-inline: 24px;

    text-align: center;

    ${PHONE} {
      min-height: 0;
      padding-block: 16px;
    }
  `,
  emptyIcon: css`
    width: 40px;
    height: 40px;
    border-radius: ${cssVar.borderRadiusLG};

    color: ${cssVar.colorTextSecondary};

    background: ${cssVar.colorFillTertiary};
  `,
}));

interface CommentWorkspaceProps {
  footer: ReactNode;
  inert?: boolean;
  panel: ReactNode;
  /** The picture being commented on. */
  stage: ReactNode;
  /**
   * `fit` centres the stage and makes it a size container (a video sizes its
   * frame to it); `scroll` lets a tall screenshot scroll inside it.
   */
  stageMode: 'fit' | 'scroll';
  strip?: ReactNode;
}

/**
 * The comment composer's frame: the evidence large on the left, the notes being
 * written in a panel on the right, sending pinned underneath. On a phone the
 * panel folds under the stage and the page scrolls; sending stays pinned.
 */
export const CommentWorkspace = ({
  footer,
  inert,
  panel,
  stage,
  stageMode,
  strip,
}: CommentWorkspaceProps) => (
  <div className={styles.root}>
    <div className={styles.body}>
      <div className={styles.stage} inert={inert}>
        {strip}
        <div className={stageMode === 'fit' ? styles.fit : styles.scroll}>{stage}</div>
      </div>
      <div className={styles.panel} inert={inert}>
        {panel}
      </div>
    </div>
    <div className={styles.footer}>{footer}</div>
  </div>
);

export const DraftPanelHeading = ({ count }: { count: number }) => {
  const { t } = useTranslation('verify');
  return (
    <Flexbox horizontal align={'baseline'} gap={8} style={{ paddingInline: 4 }}>
      <Text strong>{t('acceptance.comments.draftsTitle')}</Text>
      {count > 0 && (
        <Text fontSize={12} style={{ color: cssVar.colorTextTertiary }}>
          {count}
        </Text>
      )}
    </Flexbox>
  );
};

/** First use: show what to do with the picture, since nothing is written yet. */
export const DraftEmpty = ({ body }: { body: string }) => {
  const { t } = useTranslation('verify');
  return (
    <Center className={styles.empty}>
      <Center className={styles.emptyIcon}>
        <Icon icon={SquareDashedMousePointer} size={20} />
      </Center>
      <Text strong>{t('acceptance.comments.draftEmptyTitle')}</Text>
      <Text fontSize={12} type={'secondary'}>
        {body}
      </Text>
    </Center>
  );
};

interface DraftNoteProps {
  active?: boolean;
  autoFocus?: boolean;
  fieldRef?: Ref<HTMLTextAreaElement>;
  index: number;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onRemove: () => void;
  onSubmit: () => void;
  /** Where the note points — the video's moment, the image's region. */
  stamp?: ReactNode;
  value: string;
}

/** One comment being written: its number, where it points, its own words. */
export const DraftNote = ({
  active,
  autoFocus,
  fieldRef,
  index,
  onChange,
  onFocus,
  onRemove,
  onSubmit,
  stamp,
  value,
}: DraftNoteProps) => {
  const { t } = useTranslation('verify');
  return (
    <div className={cx(styles.note, active && styles.noteActive)}>
      <Flexbox horizontal align={'center'} gap={8}>
        <span className={styles.badge}>{index}</span>
        <Flexbox horizontal align={'center'} flex={1} gap={8} style={{ minWidth: 0 }}>
          {stamp}
        </Flexbox>
        <ActionIcon
          aria-label={t('acceptance.comments.draftRemove', { index })}
          icon={Trash2}
          size={'small'}
          title={t('acceptance.comments.draftRemove', { index })}
          onClick={onRemove}
        />
      </Flexbox>
      <TextArea
        aria-label={t('acceptance.comments.draftNumber', { index })}
        autoFocus={autoFocus}
        autoSize={{ maxRows: 8, minRows: 2 }}
        placeholder={t('acceptance.comments.draftPlaceholder')}
        ref={fieldRef}
        value={value}
        variant={active ? 'outlined' : 'filled'}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            onSubmit();
          }
        }}
      />
    </div>
  );
};

interface DraftFooterProps {
  count: number;
  disabled: boolean;
  error?: boolean;
  loading: boolean;
  onCancel: () => void;
  onSend: () => void;
  status: ReactNode;
}

/** Why sending is or is not possible, then the one primary action. */
export const DraftFooter = ({
  count,
  disabled,
  error,
  loading,
  onCancel,
  onSend,
  status,
}: DraftFooterProps) => {
  const { t } = useTranslation('verify');
  return (
    <>
      <div
        aria-live={'polite'}
        className={cx(styles.status, error && styles.statusError)}
        role={error ? 'alert' : undefined}
      >
        {status}
      </div>
      <Button className={styles.cancel} disabled={loading} onClick={onCancel}>
        {t('acceptance.actions.cancel')}
      </Button>
      <Button disabled={disabled} loading={loading} type={'primary'} onClick={onSend}>
        {count > 1 ? t('acceptance.comments.sendCount', { count }) : t('acceptance.comments.send')}
      </Button>
    </>
  );
};

/** A link-styled line in the footer status that takes you to what blocks sending. */
export const StatusLink = ({ children, onClick }: { children: ReactNode; onClick: () => void }) => (
  <button className={styles.statusLink} type={'button'} onClick={onClick}>
    {children}
  </button>
);
