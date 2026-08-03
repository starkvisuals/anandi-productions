'use client';
// components/review/CommentSidebar.js — the Frame.io comment rail (A1.2).
//
// Comments are the PRIMARY review object. Every annotation on the canvas (pin,
// box, arrow, drawing) IS a comment thread here; you can also post a general
// comment with no drawing. Each row shows author + relative time + a timecode
// chip (video, click → seek) or a pin number (image), inline-editable text,
// replies, resolve toggle, and delete.
//
// Shares the SAME items array as ReviewCanvas — an item is just extended with
// { text, author, userId, resolved, replies[] }. ReviewCanvas ignores those
// extra fields; the sidebar owns them.
//
// Controlled:
//   comments      : the items array (each: {id,type,color,videoTimestamp,createdAt, text?,author?,userId?,resolved?,replies?})
//   currentUser   : { id, name }
//   mediaType     : 'image' | 'video'
//   selectedId    : highlighted comment id
//   onSelect      : (id|null) => void
//   onSeek        : (seconds) => void        — video: seek + pause to a comment's time
//   onUpdate      : (id, patch) => void       — edit text / toggle resolved / add reply
//   onDelete      : (id) => void
//   onPost        : ({ text, videoTimestamp }) => void   — a general (no-drawing) comment
//   currentTime   : number (video) — timestamp the composer will attach
//   mentionables  : [{ id, name }]  (optional, for @mention)

import { useMemo, useRef, useState } from 'react';
import { useTheme, RADIUS, SPACE, WEIGHT } from '@/lib/theme';
import Button from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';

const TYPE_LABEL = { pin: 'Pin', rect: 'Box', circle: 'Ellipse', arrow: 'Arrow', freehand: 'Drawing', text: 'Label', general: 'Comment' };

function fmtTimecode(s) {
  s = Math.max(0, Math.floor(s || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

function relTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function CommentSidebar({
  comments = [],
  currentUser,
  mediaType = 'image',
  selectedId = null,
  onSelect,
  onSeek,
  onUpdate,
  onDelete,
  onPost,
  currentTime = 0,
  mentionables = [],
}) {
  const { t } = useTheme();
  const toast = useToast();
  const isVideo = mediaType === 'video';

  const [filter, setFilter] = useState('open'); // 'open' | 'all'
  const [draft, setDraft] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null); // string | null
  const composerRef = useRef(null);

  const openCount = comments.filter(c => !c.resolved).length;

  // Sort: video by timestamp (nulls last), else by createdAt.
  const rows = useMemo(() => {
    const list = comments.filter(c => (filter === 'all' ? true : !c.resolved));
    return [...list].sort((a, b) => {
      if (isVideo) {
        const av = a.videoTimestamp ?? Infinity, bv = b.videoTimestamp ?? Infinity;
        if (av !== bv) return av - bv;
      }
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });
  }, [comments, filter, isVideo]);

  // Pin numbering matches ReviewCanvas (order among pins in the original array).
  const pinIndex = useMemo(() => {
    const map = {};
    comments.filter(c => c.type === 'pin').forEach((c, i) => { map[c.id] = i + 1; });
    return map;
  }, [comments]);

  // ── @mention handling in the composer ──────────────────────────────────────
  const onDraftChange = (val) => {
    setDraft(val);
    const m = val.match(/(?:^|\s)@([\w]*)$/);
    setMentionQuery(m ? m[1].toLowerCase() : null);
  };
  const mentionMatches = mentionQuery != null
    ? mentionables.filter(u => u.name.toLowerCase().includes(mentionQuery)).slice(0, 5)
    : [];
  const insertMention = (name) => {
    setDraft(prev => prev.replace(/@([\w]*)$/, `@${name} `));
    setMentionQuery(null);
    composerRef.current?.focus();
  };

  const post = () => {
    const text = draft.trim();
    if (!text) return;
    onPost?.({ text, videoTimestamp: isVideo ? currentTime : null });
    setDraft(''); setMentionQuery(null);
    toast.success('Comment added');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: t.surface, borderLeft: `1px solid ${t.border}` }}>
      {/* Header */}
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: SPACE['2'], padding: `${SPACE['3']} ${SPACE['4']}`, borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 14, fontWeight: WEIGHT.bold, color: t.text }}>Comments</span>
        <span style={{ fontSize: 11, fontWeight: WEIGHT.semibold, color: t.textMuted, background: t.surfaceElev, borderRadius: RADIUS.full, padding: '2px 8px' }}>{comments.length}</span>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', gap: 2, background: t.surfaceElev, borderRadius: RADIUS.md, padding: 3 }}>
          {['open', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f}
              style={{ padding: '4px 10px', fontSize: 11, fontWeight: WEIGHT.semibold, borderRadius: RADIUS.sm, border: 'none', cursor: 'pointer', textTransform: 'capitalize', background: filter === f ? t.accent : 'transparent', color: filter === f ? t.onAccent : t.textSecondary }}>
              {f === 'open' ? `Open ${openCount ? `(${openCount})` : ''}` : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {rows.length === 0 ? (
          <EmptyState
            icon={<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
            title={filter === 'open' ? 'No open comments' : 'No comments yet'}
            description={isVideo ? 'Pause the video and drop a pin, or write a comment below.' : 'Click the frame to drop a pin, or write a comment below.'}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rows.map(c => (
              <CommentRow
                key={c.id}
                comment={c}
                pinNo={pinIndex[c.id]}
                selected={c.id === selectedId}
                isVideo={isVideo}
                currentUser={currentUser}
                onSelect={() => { onSelect?.(c.id); if (isVideo && c.videoTimestamp != null) onSeek?.(c.videoTimestamp); }}
                onSeek={() => c.videoTimestamp != null && onSeek?.(c.videoTimestamp)}
                onUpdate={(patch) => onUpdate?.(c.id, patch)}
                onDelete={() => { onDelete?.(c.id); toast.info('Comment deleted'); }}
                onResolveToggle={() => { onUpdate?.(c.id, { resolved: !c.resolved }); toast.success(c.resolved ? 'Reopened' : 'Resolved'); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <div style={{ flexShrink: 0, borderTop: `1px solid ${t.border}`, padding: SPACE['3'], position: 'relative' }}>
        {mentionMatches.length > 0 && (
          <div style={{ position: 'absolute', left: SPACE['3'], right: SPACE['3'], bottom: 'calc(100% - 4px)', background: t.surface, border: `1px solid ${t.border}`, borderRadius: RADIUS.md, boxShadow: t.shadowLg, overflow: 'hidden', zIndex: 5 }}>
            {mentionMatches.map(u => (
              <button key={u.id} onClick={() => insertMention(u.name)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: `${SPACE['2']} ${SPACE['3']}`, background: 'transparent', border: 'none', color: t.text, fontSize: 13, cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = t.surfaceHover}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                @{u.name}
              </button>
            ))}
          </div>
        )}
        {isVideo && (
          <div style={{ fontSize: 10, color: t.textMuted, marginBottom: 6, fontFamily: 'ui-monospace, monospace' }}>
            will attach @ {fmtTimecode(currentTime)}
          </div>
        )}
        <div style={{ display: 'flex', gap: SPACE['2'], alignItems: 'flex-end' }}>
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); post(); } }}
            placeholder="Add a comment…  (⌘↵ to post, @ to mention)"
            rows={2}
            style={{
              flex: 1, resize: 'none', padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, lineHeight: 1.4,
              background: t.surfaceElev, color: t.text, border: `1px solid ${t.border}`, borderRadius: RADIUS.md, outline: 'none',
            }}
          />
          <Button size="sm" onClick={post} disabled={!draft.trim()}>Post</Button>
        </div>
      </div>
    </div>
  );
}

// ── One comment row ───────────────────────────────────────────────────────────
function CommentRow({ comment: c, pinNo, selected, isVideo, currentUser, onSelect, onSeek, onUpdate, onDelete, onResolveToggle }) {
  const { t } = useTheme();
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.text || '');
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');

  const author = c.author || c.userName || 'You';
  const replies = c.replies || [];

  const saveEdit = () => { onUpdate({ text: editText.trim() }); setEditing(false); };
  const addReply = () => {
    const text = replyText.trim();
    if (!text) return;
    const reply = { id: Math.random().toString(36).slice(2, 9), text, author: currentUser?.name || 'You', userId: currentUser?.id, createdAt: new Date().toISOString() };
    onUpdate({ replies: [...replies, reply] });
    setReplyText(''); setReplyOpen(false);
  };

  return (
    <div
      onClick={onSelect}
      style={{
        padding: `${SPACE['3']} ${SPACE['4']}`,
        borderBottom: `1px solid ${t.border}`,
        background: selected ? t.surfaceHover : 'transparent',
        borderLeft: `3px solid ${selected ? c.color : 'transparent'}`,
        cursor: 'pointer',
        opacity: c.resolved ? 0.6 : 1,
      }}
    >
      {/* Head */}
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE['2'], marginBottom: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: c.color || t.accent, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: WEIGHT.semibold, color: t.text }}>{author}</span>
        {c.type === 'pin' && pinNo != null && (
          <span style={{ fontSize: 10, fontWeight: WEIGHT.bold, color: t.onAccent, background: c.color, borderRadius: RADIUS.full, minWidth: 16, height: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>{pinNo}</span>
        )}
        {c.type && c.type !== 'pin' && c.type !== 'general' && (
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.05em', color: t.textMuted, background: t.surfaceElev, borderRadius: RADIUS.sm, padding: '1px 5px' }}>{TYPE_LABEL[c.type] || c.type}</span>
        )}
        <div style={{ flex: 1 }} />
        {isVideo && c.videoTimestamp != null && (
          <button onClick={(e) => { e.stopPropagation(); onSeek(); }} title="Jump to this moment"
            style={{ fontSize: 10, fontFamily: 'ui-monospace, monospace', fontWeight: WEIGHT.semibold, color: t.onAccent, background: c.color, border: 'none', borderRadius: RADIUS.sm, padding: '2px 6px', cursor: 'pointer' }}>
            @ {fmtTimecode(c.videoTimestamp)}
          </button>
        )}
        <span style={{ fontSize: 10, color: t.textMuted }}>{relTime(c.createdAt)}</span>
      </div>

      {/* Body */}
      {editing ? (
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveEdit(); if (e.key === 'Escape') setEditing(false); }}
            rows={2}
            style={{ resize: 'none', padding: '6px 8px', fontFamily: 'inherit', fontSize: 13, background: t.surfaceElev, color: t.text, border: `1px solid ${t.ring}`, borderRadius: RADIUS.md, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
            <Button size="sm" onClick={saveEdit}>Save</Button>
          </div>
        </div>
      ) : (
        <div onClick={(e) => { e.stopPropagation(); setEditText(c.text || ''); setEditing(true); }}
          style={{ fontSize: 13, lineHeight: 1.5, color: c.text ? t.text : t.textDisabled, fontStyle: c.text ? 'normal' : 'italic', wordBreak: 'break-word' }}>
          {c.text || 'Add a note…'}
        </div>
      )}

      {/* Replies */}
      {replies.length > 0 && (
        <div style={{ marginTop: 8, paddingLeft: SPACE['3'], borderLeft: `2px solid ${t.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {replies.map(r => (
            <div key={r.id}>
              <span style={{ fontSize: 11, fontWeight: WEIGHT.semibold, color: t.text }}>{r.author}</span>
              <span style={{ fontSize: 10, color: t.textMuted, marginLeft: 6 }}>{relTime(r.createdAt)}</span>
              <div style={{ fontSize: 12, color: t.textSecondary, lineHeight: 1.4 }}>{r.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: SPACE['3'], marginTop: 8 }}>
        <button onClick={onResolveToggle} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: WEIGHT.medium, color: c.resolved ? t.success : t.textMuted }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6L9 17l-5-5" /></svg>
          {c.resolved ? 'Resolved' : 'Resolve'}
        </button>
        <button onClick={() => setReplyOpen(o => !o)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: WEIGHT.medium, color: t.textMuted }}>Reply{replies.length ? ` (${replies.length})` : ''}</button>
        <div style={{ flex: 1 }} />
        <button onClick={onDelete} aria-label="Delete comment" style={{ background: 'none', border: 'none', cursor: 'pointer', color: t.textMuted, display: 'inline-flex', padding: 2 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" /></svg>
        </button>
      </div>

      {replyOpen && (
        <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'flex-end' }}>
          <textarea autoFocus value={replyText} onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) addReply(); if (e.key === 'Escape') setReplyOpen(false); }}
            placeholder="Reply…" rows={1}
            style={{ flex: 1, resize: 'none', padding: '6px 8px', fontFamily: 'inherit', fontSize: 12, background: t.surfaceElev, color: t.text, border: `1px solid ${t.border}`, borderRadius: RADIUS.md, outline: 'none' }} />
          <Button size="sm" onClick={addReply} disabled={!replyText.trim()}>Send</Button>
        </div>
      )}
    </div>
  );
}
