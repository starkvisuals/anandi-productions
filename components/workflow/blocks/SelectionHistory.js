// components/workflow/blocks/SelectionHistory.js
// E5: Producer-facing history of client selection submissions for a SelectionRound block.
// Fetches selectionSnapshots subcollection, renders collapsible rows with thumbnails.
import { useState, useEffect, useCallback } from 'react';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { DEFAULT_COLOR_LABELS } from '../../../lib/workflow/constants';
import { snapshotToCSV, downloadCSV } from '../../../lib/workflow/exportSelections';

// ── helpers ────────────────────────────────────────────────────────────────────

function formatTimeAgo(ts) {
  if (!ts) return '';
  const d = ts?.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d)) return '';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── SkeletonRow — matches ActivityFeedDrawer pattern ──────────────────────────

function SkeletonRow({ t }) {
  return (
    <div
      style={{
        padding: '10px 0',
        borderBottom: `1px solid ${t.borderLight || t.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: '7px',
      }}
    >
      <div
        style={{
          height: '11px',
          borderRadius: '4px',
          background: t.border,
          width: '55%',
        }}
      />
      <div
        style={{
          height: '10px',
          borderRadius: '4px',
          background: t.borderLight || t.border,
          width: '80%',
          opacity: 0.6,
        }}
      />
    </div>
  );
}

// ── SnapThumb — 48×48 thumbnail with optional color-label strip ───────────────

function SnapThumb({ assetId, label, projectAssets, t }) {
  const asset = projectAssets.find(a => a.id === assetId);
  const hex = label
    ? DEFAULT_COLOR_LABELS.find(c => c.key === label)?.hex
    : null;
  return (
    <div
      style={{
        position: 'relative',
        width: '48px',
        height: '48px',
        flexShrink: 0,
        borderRadius: '6px',
        overflow: 'hidden',
        background: t.bgInput,
        border: `1px solid ${t.border}`,
      }}
    >
      {asset?.previewUrl && (
        <img
          src={asset.previewUrl}
          alt={asset.name || assetId}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      {hex && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: hex,
          }}
        />
      )}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

function Badge({ label, color, t }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 7px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        background: color + '22',
        color: color,
        border: `1px solid ${color}44`,
        lineHeight: 1.4,
        flexShrink: 0,
      }}
    >
      {label}
    </span>
  );
}

// ── SubmissionRow — single collapsible <details> ──────────────────────────────

const MAX_VISIBLE_THUMBS = 10;

function SubmissionRow({ snap, index, total, projectAssets, projectName, t }) {
  const isLatest = index === 0;
  const submissionNum = total - index; // #1 is oldest; latest is highest number
  // We display newest-first so submission #(total) is index 0 (latest)
  const displayNum = total - index;

  const timeAgo = formatTimeAgo(snap.submittedAt);
  const selectedAssets = (snap.assets || []).filter(a => a.isSelected);
  const visibleAssets = selectedAssets.slice(0, MAX_VISIBLE_THUMBS);
  const overflow = selectedAssets.length - visibleAssets.length;

  return (
    <details
      style={{
        borderBottom: `1px solid ${t.border}`,
        userSelect: 'none',
      }}
      open={isLatest}
    >
      <summary
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 0',
          cursor: 'pointer',
          listStyle: 'none',
          outline: 'none',
        }}
      >
        {/* chevron */}
        <span
          style={{
            fontSize: '10px',
            color: t.textMuted,
            width: '12px',
            flexShrink: 0,
            transition: 'transform 0.15s',
          }}
          aria-hidden="true"
        >
          ▶
        </span>

        {/* title */}
        <span style={{ fontSize: '13px', fontWeight: 600, color: t.text, flexShrink: 0 }}>
          Submission #{displayNum}
          {isLatest && (
            <span
              style={{
                marginLeft: '6px',
                fontSize: '10px',
                fontWeight: 500,
                color: t.primary || '#6366f1',
              }}
            >
              (latest)
            </span>
          )}
        </span>

        {/* metadata row */}
        <span style={{ fontSize: '11px', color: t.textMuted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {timeAgo && `${timeAgo} · `}
          {snap.pickCount != null ? `${snap.pickCount} pick${snap.pickCount !== 1 ? 's' : ''}` : `${selectedAssets.length} pick${selectedAssets.length !== 1 ? 's' : ''}`}
        </span>

        {/* badges */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0, marginLeft: 'auto' }}>
          {snap.forced && <Badge label="Force-submitted" color="#f59e0b" t={t} />}
          {snap.source === 'mobile-done' && <Badge label="Mobile" color="#6366f1" t={t} />}
        </div>
      </summary>

      {/* Expanded content */}
      <div style={{ paddingBottom: '12px', paddingLeft: '20px' }}>
        {selectedAssets.length === 0 ? (
          <span style={{ fontSize: '12px', color: t.textMuted }}>No selected images in this submission.</span>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
              alignItems: 'center',
            }}
          >
            {visibleAssets.map(asset => (
              <SnapThumb
                key={asset.id}
                assetId={asset.id}
                label={asset.colorLabel}
                projectAssets={projectAssets}
                t={t}
              />
            ))}
            {overflow > 0 && (
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  flexShrink: 0,
                  borderRadius: '6px',
                  background: t.bgInput,
                  border: `1px solid ${t.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: t.textMuted,
                  fontWeight: 600,
                }}
              >
                +{overflow}
              </div>
            )}
          </div>
        )}

        {/* picks count chip */}
        {selectedAssets.length > 0 && (
          <div style={{ marginTop: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 9px',
                borderRadius: '10px',
                fontSize: '11px',
                fontWeight: 500,
                background: t.bgInput,
                color: t.textSecondary,
                border: `1px solid ${t.border}`,
              }}
            >
              ✓ {selectedAssets.length} image{selectedAssets.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        )}

        {/* Export CSV button */}
        <button
          onClick={() => {
            const csv = snapshotToCSV(snap, projectAssets, projectName);
            const idx = total - index; // submission number
            downloadCSV(csv, `${projectName || 'Project'}-Selection-${String(idx).padStart(3, '0')}.csv`);
          }}
          style={{
            marginTop: '8px',
            padding: '5px 10px',
            background: 'transparent',
            border: `1px solid ${t.border}`,
            borderRadius: '6px',
            color: t.textSecondary,
            fontSize: '11px',
            cursor: 'pointer',
          }}
        >
          ⬇ Export CSV
        </button>
      </div>

      <style>{`
        details[open] > summary span[aria-hidden="true"] {
          transform: rotate(90deg);
          display: inline-block;
        }
      `}</style>
    </details>
  );
}

// ── SelectionHistory (main export) ────────────────────────────────────────────

export default function SelectionHistory({ projectId, block, t, theme, projectAssets, projectName }) {
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSnapshots = useCallback(async () => {
    if (!projectId || !block?.id) return;
    setLoading(true);
    setError(null);
    try {
      const snap = await getDocs(
        query(
          collection(db, 'projects', projectId, 'selectionSnapshots'),
          where('blockId', '==', block.id),
          orderBy('submittedAt', 'desc'),
        )
      );
      setSnapshots(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('[SelectionHistory] fetch error', err);
      setError('Could not load history');
    } finally {
      setLoading(false);
    }
  }, [projectId, block?.id]);

  useEffect(() => {
    fetchSnapshots();
  }, [fetchSnapshots]);

  const safeAssets = Array.isArray(projectAssets) ? projectAssets : [];

  return (
    <div
      style={{
        marginTop: '16px',
        padding: '14px 16px',
        background: t.bgCard,
        border: `1px solid ${t.border}`,
        borderRadius: '10px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 700, color: t.text }}>
          Selection History
        </span>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {snapshots.length > 0 && (
            <button
              onClick={() => {
                const latest = snapshots[0]; // already sorted desc
                const csv = snapshotToCSV(latest, safeAssets, projectName);
                downloadCSV(csv, `${projectName || 'Project'}-Selection-latest.csv`);
              }}
              style={{ padding: '4px 8px', background: 'transparent', border: `1px solid ${t.border}`, borderRadius: '6px', color: t.textSecondary, fontSize: '11px', cursor: 'pointer' }}
            >
              ⬇ Export Latest CSV
            </button>
          )}
          <button
            onClick={fetchSnapshots}
            disabled={loading}
            title="Refresh"
            style={{
              background: 'transparent',
              border: `1px solid ${t.border}`,
              borderRadius: '6px',
              padding: '4px 9px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: loading ? t.textMuted : t.textSecondary,
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'opacity 0.15s',
              opacity: loading ? 0.5 : 1,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                animation: loading ? 'spin 0.8s linear infinite' : 'none',
              }}
            >
              ↻
            </span>
            Refresh
          </button>
        </div>
      </div>

      <div
        style={{
          borderTop: `1px solid ${t.border}`,
        }}
      >
        {loading ? (
          <>
            <SkeletonRow t={t} />
            <SkeletonRow t={t} />
          </>
        ) : error ? (
          <p
            style={{
              fontSize: '12px',
              color: t.textMuted,
              padding: '12px 0',
              margin: 0,
            }}
          >
            {error}
          </p>
        ) : snapshots.length === 0 ? (
          <p
            style={{
              fontSize: '12px',
              color: t.textMuted,
              padding: '12px 0',
              margin: 0,
            }}
          >
            No submissions yet for this block.
          </p>
        ) : (
          snapshots.map((snap, i) => (
            <SubmissionRow
              key={snap.id}
              snap={snap}
              index={i}
              total={snapshots.length}
              projectAssets={safeAssets}
              projectName={projectName}
              t={t}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
