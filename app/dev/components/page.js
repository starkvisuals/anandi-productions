'use client';
// app/dev/components/page.js — component library preview.
//
// Visit /dev/components to see every primitive in both dark + light.
// Not part of Phase 2 migration — this exists only to eyeball tokens and
// verify keyboard focus.

import { useState } from 'react';
import { ThemeProvider, useTheme, TOKENS, SPACE, RADIUS, WEIGHT } from '@/lib/theme';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Menu, { useContextMenu } from '@/components/ui/Menu';
import { Skeleton, SkeletonRows, Spinner, LoadingPanel, EmptyState, EmptyValue } from '@/components/ui/Feedback';
import { useToast } from '@/components/ui/Toast';

// A tiny SVG icon for the Button icon slot demo — no dependency on Lucide yet.
const IconStar = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

export default function DevComponentsPreview() {
  // Two independent ThemeProviders so we can render dark + light side by side.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
      <ThemeProvider initial="dark" sync={false}><Panel label="Dark" /></ThemeProvider>
      <ThemeProvider initial="light" sync={false}><Panel label="Light" /></ThemeProvider>
    </div>
  );
}

function Panel({ label }) {
  const { t, mode } = useTheme();
  const [text, setText] = useState('');
  const [option, setOption] = useState('');

  return (
    <div style={{
      background: t.bg,
      color: t.text,
      padding: SPACE['6'],
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE['6'],
      minHeight: '100vh',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
    }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: SPACE['3'] }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: WEIGHT.bold, letterSpacing: '-0.01em' }}>{label} mode</h1>
        <span style={{ fontSize: 11, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Anandi UI · component library preview
        </span>
      </header>

      {/* Tokens visual */}
      <Section title="Tokens">
        <TokenSwatches />
      </Section>

      {/* Buttons */}
      <Section title="Buttons">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE['3'] }}>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="accent">Accent</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE['3'] }}>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE['3'] }}>
          <Button iconLeft={<IconStar />}>With icon left</Button>
          <Button iconRight={<IconStar />}>With icon right</Button>
          <Button ariaLabel="Favourite" iconLeft={<IconStar />} />
          <Button loading>Saving…</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      {/* Inputs */}
      <Section title="Inputs">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE['4'] }}>
          <Input label="Email" type="email" placeholder="you@example.com" value={text} onChange={(e) => setText(e.target.value)} />
          <Input label="Amount" type="number" required helper="Enter a positive number" />
          <Input label="Broken" error="Value must be > 0" defaultValue="-3" />
          <Input label="Disabled" disabled defaultValue="Read only" />
          <Select label="Department" value={option} onChange={(e) => setOption(e.target.value)}>
            <option value="">Select…</option>
            <option value="hr">HR</option>
            <option value="edit">Editing</option>
            <option value="shoot">Shooting</option>
          </Select>
          <Textarea label="Reason" helper="Optional. Max 500 chars." rows={3} />
        </div>
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE['4'] }}>
          <Card>
            <h3 style={{ margin: 0, marginBottom: SPACE['2'], fontSize: 16, fontWeight: WEIGHT.semibold }}>Static card</h3>
            <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
              No shadow, hairline border, radius 12. This is the neutral surface for content.
            </p>
          </Card>
          <Card interactive onClick={() => alert('clicked')}>
            <h3 style={{ margin: 0, marginBottom: SPACE['2'], fontSize: 16, fontWeight: WEIGHT.semibold }}>Interactive card</h3>
            <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
              Cursor pointer, elevates on hover, becomes a button (role=button, keyboard-accessible).
            </p>
          </Card>
          <Card elevated padding="lg">
            <h3 style={{ margin: 0, marginBottom: SPACE['2'], fontSize: 16, fontWeight: WEIGHT.semibold }}>Elevated card</h3>
            <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
              Persistent shadow. Reserved for surfaces that need visual lift at rest.
            </p>
          </Card>
          <Card bordered={false} padding="sm">
            <h3 style={{ margin: 0, marginBottom: SPACE['2'], fontSize: 16, fontWeight: WEIGHT.semibold }}>Borderless card</h3>
            <p style={{ margin: 0, fontSize: 13, color: t.textSecondary, lineHeight: 1.5 }}>
              For nested cards or when the surrounding surface already frames it.
            </p>
          </Card>
        </div>
      </Section>

      {/* Toasts */}
      <Section title="Toasts (global — every action fires one)">
        <ToastDemo />
      </Section>

      {/* Modal */}
      <Section title="Modal">
        <ModalDemo />
      </Section>

      {/* Menu / right-click */}
      <Section title="Menu & right-click context menu">
        <MenuDemo />
      </Section>

      {/* Feedback: skeleton / spinner / empty */}
      <Section title="Loading & empty states">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE['4'] }}>
          <Card padding="md">
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: SPACE['2'] }}>SkeletonRows</div>
            <SkeletonRows rows={3} />
          </Card>
          <Card padding="md">
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: SPACE['2'] }}>Spinner + LoadingPanel</div>
            <LoadingPanel label="Loading employees…" minHeight={100} />
          </Card>
          <Card padding="none">
            <EmptyState
              icon={<IconStar />}
              title="No employees yet"
              description="Add your first employee or import an existing team member."
              action={<Button size="sm">Add employee</Button>}
            />
          </Card>
          <Card padding="md">
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: SPACE['2'] }}>EmptyValue (inline, replaces bare —)</div>
            <div style={{ fontSize: 13 }}>Work location: <EmptyValue>Not set</EmptyValue></div>
            <div style={{ fontSize: 13, marginTop: 6 }}>Reporting manager: <EmptyValue /></div>
          </Card>
        </div>
      </Section>

      {/* Focus / keyboard nav test */}
      <Section title="Focus test — press TAB">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE['3'] }}>
          <Button variant="primary">A</Button>
          <Button variant="secondary">B</Button>
          <Button variant="ghost">C</Button>
          <Input label="Focus me" size="sm" />
          <Select label="Focus me" size="sm"><option>1</option><option>2</option></Select>
        </div>
        <p style={{ fontSize: 11, color: t.textMuted, marginTop: SPACE['2'] }}>
          Every focusable element should show a 2px yellow ring on keyboard focus (mouse clicks won't paint it).
        </p>
      </Section>
    </div>
  );
}

function ToastDemo() {
  const toast = useToast();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE['3'] }}>
      <Button size="sm" variant="secondary" onClick={() => toast.success('Employee added')}>Success</Button>
      <Button size="sm" variant="secondary" onClick={() => toast.error('Could not save', { title: 'Save failed' })}>Error</Button>
      <Button size="sm" variant="secondary" onClick={() => toast.info('Draft saved automatically')}>Info</Button>
      <Button size="sm" variant="secondary" onClick={() => toast.warning('Approaching your leave limit')}>Warning</Button>
      <Button size="sm" variant="secondary" onClick={() => toast.promise(new Promise((r) => setTimeout(r, 1400)), { loading: 'Uploading…', success: 'Uploaded', error: 'Failed' })}>Promise</Button>
    </div>
  );
}

function ModalDemo() {
  const [open, setOpen] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Open modal</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Add Employee" description="Fill in the details and send an invite." size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE['4'] }}>
          <Input label="Full name" placeholder="Riya Sharma" />
          <Input label="Email" type="email" placeholder="riya@anandi.com" />
        </div>
        <Modal.Footer>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => { setOpen(false); toast.success('Employee added'); }}>Save</Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

function MenuDemo() {
  const { t } = useTheme();
  const toast = useToast();
  const items = [
    { label: 'Create Share Link', onClick: () => toast.success('Share link created') },
    { label: 'Add to Share Links', submenu: true, onClick: () => {} },
    { divider: true },
    { label: 'Download', onClick: () => toast.info('Downloading…') },
    { label: 'Copy Asset URL', hint: '⌘C', onClick: () => toast.success('URL copied') },
    { label: 'Rename', onClick: () => {} },
    { divider: true },
    { label: 'Delete', danger: true, onClick: () => toast.error('Deleted') },
  ];
  const { onContextMenu, menu } = useContextMenu(items);
  return (
    <div style={{ display: 'flex', gap: SPACE['4'], alignItems: 'center', flexWrap: 'wrap' }}>
      <Menu trigger={<Button size="sm" variant="secondary">Actions ▾</Button>} items={items} />
      <div
        onContextMenu={onContextMenu}
        style={{
          padding: `${SPACE['4']} ${SPACE['6']}`, border: `1px dashed ${t.borderStrong}`,
          borderRadius: RADIUS.md, color: t.textMuted, fontSize: 13, userSelect: 'none',
        }}
      >
        Right-click me
      </div>
      {menu}
    </div>
  );
}

function Section({ title, children }) {
  const { t } = useTheme();
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: SPACE['3'] }}>
      <h2 style={{
        margin: 0, fontSize: 11, fontWeight: WEIGHT.bold, textTransform: 'uppercase',
        letterSpacing: '0.08em', color: t.textMuted,
      }}>{title}</h2>
      {children}
    </section>
  );
}

function TokenSwatches() {
  const { t, mode } = useTheme();
  const swatches = [
    ['bg', t.bg],
    ['surface', t.surface],
    ['surfaceElev', t.surfaceElev],
    ['border', t.border],
    ['text', t.text],
    ['textMuted', t.textMuted],
    ['primary', t.primary],
    ['accent', t.accent],
    ['success', t.success],
    ['warning', t.warning],
    ['danger', t.danger],
    ['ring', t.ring],
  ];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: SPACE['3'] }}>
      {swatches.map(([name, value]) => (
        <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{
            height: 40,
            background: value,
            border: `1px solid ${t.border}`,
            borderRadius: RADIUS.md,
          }} />
          <div style={{ fontSize: 10, color: t.textMuted, fontFamily: 'ui-monospace, monospace' }}>{name}</div>
          <div style={{ fontSize: 10, color: t.textSecondary, fontFamily: 'ui-monospace, monospace' }}>{value}</div>
        </div>
      ))}
    </div>
  );
}
