// lib/workflow/constants.js

export const BLOCK_TYPES = {
  UploadBlock: 'UploadBlock',
  SelectionRound: 'SelectionRound',
  ProductionBlock: 'ProductionBlock',
  ApprovalRound: 'ApprovalRound',
  AdaptBlock: 'AdaptBlock',
  DeliveryBlock: 'DeliveryBlock',
  Checkpoint: 'Checkpoint',
  Parallel: 'Parallel',
};

export const BLOCK_STATUS = {
  LOCKED: 'locked',
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  DONE: 'done',
  SKIPPED: 'skipped',
};

export const WORKFLOW_ROLES = {
  PRODUCER: 'producer',
  CLIENT: 'client',
  EDITOR: 'editor',
  COLORIST: 'colorist',
  VFX: 'vfx',
  AUDIO: 'audio',
  MUSIC: 'music',
  AGENCY: 'agency',
  PHOTOGRAPHER: 'photographer',
};

export const UPLOAD_VARIANTS = {
  RAWS: 'raws',
  REFERENCES: 'references',
  OFFLINE_EDIT: 'offline-edit',
  HI_RES: 'hi-res',
};

export const PRODUCTION_SPECIALTIES = {
  EDIT: 'edit',
  GRADING: 'grading',
  VFX: 'vfx',
  AUDIO: 'audio',
  MUSIC: 'music',
  SUPERS: 'supers',
  AI_GEN: 'ai-gen',
  GENERIC: 'generic',
};

export const APPROVAL_MODES = {
  CORRECTION_OR_APPROVE: 'correction-or-approve',
  PICK_ONE_OF_MANY: 'pick-one-of-many',
};

export const ACTIVITY_TYPES = {
  BLOCK_STARTED: 'block.started',
  BLOCK_COMPLETED: 'block.completed',
  BLOCK_INSERTED: 'block.inserted',
  BLOCK_REMOVED: 'block.removed',
  SELECTION_REQUESTED: 'selection.requested',
  SELECTION_SUBMITTED: 'selection.submitted',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_GRANTED: 'approval.granted',
  APPROVAL_CORRECTIONS: 'approval.corrections',
  PRODUCTION_COMPLETED: 'production.completed',
  ASSET_UPLOADED: 'asset.uploaded',
  ASSET_VERSION_UPLOADED: 'asset.version.uploaded',
  REFERENCE_PINNED: 'reference.pinned',
  ASSET_REQUEST_CREATED: 'asset-request.created',
  ASSET_REQUEST_APPROVED: 'asset-request.approved',
  ASSET_REQUEST_FULFILLED: 'asset-request.fulfilled',
  COMMENT_POSTED: 'comment.posted',
  MENTION: 'mention',
  TEAM_ADDED: 'team.added',
  TEAM_REMOVED: 'team.removed',
  DELIVERY_READY: 'delivery.ready',
  REVISION_ROUND_EXTRA_REQUESTED: 'revision.extra.requested',
  REVISION_ROUND_EXTRA_RESOLVED: 'revision.extra.resolved',
};

export const EMAIL_TEMPLATES = {
  SELECTION_REQUESTED: 'selection.requested',
  SELECTION_REMINDER: 'selection.reminder',
  SELECTION_OVERDUE: 'selection.overdue',
  SELECTION_SUBMITTED: 'selection.submitted',
  APPROVAL_REQUESTED: 'approval.requested',
  APPROVAL_GRANTED: 'approval.granted',
  APPROVAL_CORRECTIONS: 'approval.corrections.requested',
  APPROVAL_ROUND_LIMIT: 'approval.round-limit-hit',
  PRODUCTION_COMPLETED: 'production.completed',
  DELIVERY_READY: 'delivery.ready',
  ASSET_REQUEST_CREATED: 'asset-request.created',
  ASSET_REQUEST_APPROVED: 'asset-request.approved',
  ASSET_REQUEST_FULFILLED: 'asset-request.fulfilled',
  PHOTOGRAPHER_UPLOAD_INVITE: 'photographer.upload-invite',
  MENTION: 'mention',
  BLOCK_UPLOAD_REQUESTED: 'block.upload.requested',
};

// Default color label set (7 colors — Capture One style)
export const DEFAULT_COLOR_LABELS = [
  { key: 'red',    label: 'Pick',    hex: '#ef4444' },
  { key: 'yellow', label: 'Maybe',   hex: '#eab308' },
  { key: 'green',  label: 'Alt',     hex: '#22c55e' },
  { key: 'blue',   label: 'Hero',    hex: '#3b82f6' },
  { key: 'purple', label: 'Reject',  hex: '#a855f7' },
  { key: 'orange', label: 'Review',  hex: '#f97316' },
  { key: 'gray',   label: 'Skip',    hex: '#6b7280' },
];

export const DEFAULT_REVISION_LIMIT = 3;
export const DEFAULT_SLA_HOURS = {
  SELECTION: 72,
  APPROVAL: 48,
  PRODUCTION: 72,
  UPLOAD: 168,
  CHECKPOINT: 24,
};
