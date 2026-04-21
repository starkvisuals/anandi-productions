// scripts/seed-workflow-templates.js
// Run locally: node scripts/seed-workflow-templates.js
// Requires firebase-admin credentials (GOOGLE_APPLICATION_CREDENTIALS).

const admin = require('firebase-admin');
admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

const PHOTOSHOOT_TEMPLATE = {
  name: 'Photoshoot',
  description: 'Standard photoshoot: upload → select → edit → approve → adapt → deliver',
  icon: 'camera',
  color: '#8b5cf6',
  isSystemDefault: true,
  isActive: true,
  createdBy: 'system',
  blocks: [
    {
      order: 1,
      type: 'UploadBlock',
      variant: 'raws',
      label: 'Upload Raws',
      defaultRole: 'producer',
      defaultSLAHours: 168,
      config: {
        allowPublicLink: true,
        acceptedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        maxFileSizeMB: 50,
      },
    },
    {
      order: 2,
      type: 'SelectionRound',
      label: 'Client Selection',
      defaultRole: 'client',
      defaultSLAHours: 72,
      config: {
        ratingSystems: ['stars', 'colors'],
        mobileSwipe: true,
        allowSnapshots: true,
        allowCompare: true,
      },
    },
    {
      order: 3,
      type: 'Checkpoint',
      label: 'Assign Editor',
      defaultRole: 'producer',
      defaultSLAHours: 24,
      config: {
        prompt: 'Selection complete. Assign editor(s) to proceed.',
        requiredActions: ['assign-editor'],
      },
    },
    {
      order: 4,
      type: 'ProductionBlock',
      variant: 'edit',
      label: 'Edit Work',
      defaultRole: 'editor',
      defaultSLAHours: 72,
      config: {
        specialty: 'edit',
        allowAssetRequests: true,
        requireAllAssetsVersioned: true,
      },
    },
    {
      order: 5,
      type: 'ApprovalRound',
      label: 'Client Approval',
      defaultRole: 'client',
      defaultSLAHours: 48,
      config: {
        mode: 'correction-or-approve',
        allowAnnotations: true,
      },
    },
    {
      order: 6,
      type: 'AdaptBlock',
      label: 'Adapts',
      defaultRole: 'editor',
      defaultSLAHours: 48,
      config: {
        requiredAdapts: [
          { name: 'Master', width: null, height: null },
          { name: '1:1', width: 1080, height: 1080 },
          { name: '9:16', width: 1080, height: 1920 },
          { name: '4:5', width: 1080, height: 1350 },
        ],
        allowCustomPerAsset: true,
      },
    },
    {
      order: 7,
      type: 'DeliveryBlock',
      label: 'Delivery',
      defaultRole: 'client',
      defaultSLAHours: null,
      config: {
        allowBulkZip: true,
        unlockHiResOnEnter: true,
      },
    },
  ],
};

(async () => {
  const ref = db.collection('workflowTemplates').doc('tpl_photoshoot');
  const existing = await ref.get();
  if (existing.exists && existing.data().isSystemDefault) {
    console.log('Photoshoot template already exists. Overwriting with latest definition.');
  }
  await ref.set(
    {
      ...PHOTOSHOOT_TEMPLATE,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: false }
  );
  console.log('Seeded tpl_photoshoot');
  process.exit(0);
})();
