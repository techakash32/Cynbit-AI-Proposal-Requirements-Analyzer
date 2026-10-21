import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { api } from '../../lib/api';
import type { User } from '../../types/api';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/fields';
import { Card } from '../../components/ui/surfaces';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger, Dialog, DialogContent, DialogDescription, DialogTitle } from '../../components/ui/radix';
import { useToast } from '../../components/ui/toast';
import { PageHeader } from '../../components/shared/workbench';

const profileSchema = z.object({ name: z.string().trim().min(1, 'Enter your name.').max(160, 'Name must be 160 characters or fewer.') });
const passwordSchema = z.object({ current_password: z.string().min(1, 'Enter the current password.'), new_password: z.string().min(12, 'Use at least 12 characters.'), confirm_password: z.string() }).refine((value) => value.new_password === value.confirm_password, { path: ['confirm_password'], message: 'Passwords do not match.' });

export default function SettingsHelpPage({ page }: { page: 'settings' | 'help' }) {
  const [profileName, setProfileName] = useState('');
  const [profileError, setProfileError] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteWord, setDeleteWord] = useState('');
  const [saving, setSaving] = useState(false);
  const user = useQuery({ queryKey: ['me'], queryFn: () => api<User>('/auth/me'), enabled: page === 'settings' });
  const client = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (user.data?.name) setProfileName(user.data.name);
  }, [user.data?.name]);

  if (page === 'help') return <HelpPage />;

  async function updateProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError('');
    const parsed = profileSchema.safeParse({ name: profileName });
    if (!parsed.success) {
      setProfileError(parsed.error.issues[0]?.message ?? 'Check your name.');
      return;
    }
    setProfileSaving(true);
    try {
      const updated = await api<User>('/auth/me', { method: 'PATCH', body: JSON.stringify(parsed.data) });
      client.setQueryData(['me'], updated);
      setProfileName(updated.name);
      toast('Profile updated.');
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : 'Could not update your profile.');
    } finally {
      setProfileSaving(false);
    }
  }

  async function updatePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const parsed = passwordSchema.safeParse({ current_password: currentPassword, new_password: newPassword, confirm_password: confirmPassword });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? 'Check the password fields.');
      return;
    }
    setSaving(true);
    try {
      await api('/auth/password', { method: 'POST', body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }) });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast('Password updated.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    if (deleteWord !== 'delete') return;
    setSaving(true);
    try {
      await api('/auth/me', { method: 'DELETE' });
      await client.clear();
      navigate('/signup', { replace: true });
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not delete the account.', 'error');
    } finally {
      setSaving(false);
      setDeleteOpen(false);
    }
  }

  return <>
    <PageHeader title="Settings" description="Manage your profile and account security." />
    <div className="grid max-w-3xl gap-4">
      <Card className="p-4">
        <h2 className="font-semibold">Profile</h2>
        {user.error && <p className="mt-2 text-sm text-error" role="alert">{user.error instanceof Error ? user.error.message : 'Could not load your profile.'}</p>}
        <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void updateProfile(event)}>
          <div><Label htmlFor="profile-name">Full name</Label><Input id="profile-name" className="mt-1" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={160} autoComplete="name" disabled={user.isLoading || profileSaving} /></div>
          <div><Label htmlFor="profile-email">Email · read-only</Label><Input id="profile-email" className="mt-1" value={user.data?.email ?? ''} readOnly aria-readonly="true" /></div>
          <div className="sm:col-span-2">{profileError && <p className="mb-2 text-xs text-error" role="alert">{profileError}</p>}<Button type="submit" disabled={user.isLoading || profileSaving}>{profileSaving ? 'Saving…' : 'Save profile'}</Button></div>
        </form>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">Change password</h2>
        <form className="mt-4 grid max-w-md gap-3" onSubmit={(event) => void updatePassword(event)}>
          <div><Label htmlFor="current-password">Current password</Label><Input id="current-password" className="mt-1" type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} /></div>
          <div><Label htmlFor="new-password">New password</Label><Input id="new-password" className="mt-1" type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} /></div>
          <div><Label htmlFor="confirm-new-password">Confirm new password</Label><Input id="confirm-new-password" className="mt-1" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>
          {formError && <p className="text-xs text-error" role="alert">{formError}</p>}
          <div><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Update password'}</Button></div>
        </form>
      </Card>
      <Card className="border-action p-4">
        <h2 className="font-semibold">Delete account</h2>
        <p className="mt-2 text-sm text-muted-copy">Delete your account and associated project data. This action is permanent.</p>
        <Button variant="danger" className="mt-4" onClick={() => { setDeleteWord(''); setDeleteOpen(true); }}>Delete account</Button>
      </Card>
    </div>
    <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
      <DialogContent>
        <DialogTitle>Confirm account deletion</DialogTitle>
        <DialogDescription>Type the word “delete” to permanently remove your account and associated data.</DialogDescription>
        <Label htmlFor="delete-confirm" className="mt-4">Confirmation</Label>
        <Input id="delete-confirm" className="mt-1" value={deleteWord} onChange={(event) => setDeleteWord(event.target.value)} />
        <div className="mt-4 flex justify-end gap-2"><Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button><Button variant="danger" disabled={deleteWord !== 'delete' || saving} onClick={() => void deleteAccount()}>{saving ? 'Deleting…' : 'Delete permanently'}</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}

function HelpPage() {
  return <>
    <PageHeader title="Help & Documentation" description="Setup notes, troubleshooting, and known limitations." />
    <div className="grid max-w-4xl gap-4">
      <Card className="p-4">
        <h2 className="font-semibold">Setup</h2>
        <p className="mt-2 text-sm text-muted-copy">Configure the Neon connection string and Groq API key in the protected runtime environment. Apply <code>database/schema.sql</code>, then start the FastAPI API and Vite frontend as described in the README.</p>
        <p className="mt-2 text-sm text-muted-copy">PDF, DOCX, and TXT ingestion extracts available text for analysis. Source documents are treated as untrusted input; the output remains a draft for human review.</p>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">Troubleshooting</h2>
        <ul className="mt-2 list-inside list-disc space-y-2 text-sm text-muted-copy">
          <li>Database unavailable: confirm <code>DATABASE_URL</code>, TLS settings, network access, and schema version.</li>
          <li>Analysis cannot start: confirm the Groq API key and model availability; provider failures remain visible rather than turning into invented results.</li>
          <li>Files with no extractable text may require external OCR; this prototype does not provide OCR.</li>
          <li>For local HTTP development keep <code>PUBLIC_HTTPS=false</code>; set it to true only for public HTTPS Preview or hosted deployments.</li>
        </ul>
        <a className="mt-3 inline-block text-sm underline underline-offset-4" href="/README.md" target="_blank" rel="noreferrer">Open README</a>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">Limitations</h2>
        <Accordion type="multiple" className="mt-2">
          <AccordionItem value="ocr"><AccordionTrigger>OCR unavailable</AccordionTrigger><AccordionContent>Scanned pages and embedded images are not OCR-processed. Analysis can only use text that the document extractor can read.</AccordionContent></AccordionItem>
          <AccordionItem value="evidence"><AccordionTrigger>Evidence may be null</AccordionTrigger><AccordionContent>When no verbatim supporting passage and source page can be established, evidence is null and the UI states that no supporting evidence was found. The system must not invent evidence.</AccordionContent></AccordionItem>
          <AccordionItem value="estimate"><AccordionTrigger>Estimate assumptions and persistence</AccordionTrigger><AccordionContent>Effort and cost are preliminary ranges, not a quote. Costs use person-hours × hourly rate × contingency; schedule ranges use sequential person-hours ÷ (team size × eight working hours per day). Edited estimate assumptions recalculate in the current page but are not saved to the analysis; human review is required.</AccordionContent></AccordionItem>
          <AccordionItem value="jobs"><AccordionTrigger>Analysis job recovery</AccordionTrigger><AccordionContent>Analysis status is persisted and can be fetched after navigation or reload while the API process is running. Work itself runs in that API process; a server restart cancels an in-flight job, and automatic restart recovery or retry is not implemented.</AccordionContent></AccordionItem>
          <AccordionItem value="citations"><AccordionTrigger>Proposal citations</AccordionTrigger><AccordionContent>Requirement and risk evidence is shown separately in the analysis workspace. Proposal prose is a draft and does not include sentence-level source citations; verify its claims against the source document.</AccordionContent></AccordionItem>
          <AccordionItem value="quality"><AccordionTrigger>AI quality is not measured</AccordionTrigger><AccordionContent>The included checks validate schemas, deterministic formulas, and synthetic examples. No real-world accuracy, completeness, or recommendation-quality benchmark has been measured.</AccordionContent></AccordionItem>
          <AccordionItem value="catalog"><AccordionTrigger>Company catalog and endorsement</AccordionTrigger><AccordionContent>Company service-catalog claims remain unverified. This is an assessment prototype and is not an official Cynbit Technologies product or endorsement.</AccordionContent></AccordionItem>
          <AccordionItem value="configuration"><AccordionTrigger>Features still dependent on configuration</AccordionTrigger><AccordionContent>The Neon database schema must be applied and the Groq key must be configured in the deployment runtime. Provider availability may change; failures are surfaced rather than being represented as successful analysis.</AccordionContent></AccordionItem>
        </Accordion>
      </Card>
    </div>
  </>;
}
