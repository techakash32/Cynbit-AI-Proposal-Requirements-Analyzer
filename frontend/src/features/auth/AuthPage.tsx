import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../../lib/api';
import { Button } from '../../components/ui/button';
import { Input, Label } from '../../components/ui/fields';
import { useToast } from '../../components/ui/toast';
import type { SessionState } from '../../types/api';
import { BrandSignature } from '../../components/shared/BrandSignature';
import { signupRequestPayload } from './payload';

const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().email('Enter a valid email address.'),
  password: z.string().min(12, 'Use at least 12 characters.'),
  confirmPassword: z.string(),
}).refine((value) => value.password === value.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match.' });
const loginSchema = z.object({ email: z.string().trim().email('Enter a valid email address.'), password: z.string().min(1, 'Enter your password.') });
type SignupValues = z.infer<typeof signupSchema>;
type LoginValues = z.infer<typeof loginSchema>;

export default function AuthPage({ mode }: { mode: 'signup' | 'login' }) {
  const signup = mode === 'signup';
  const schema = signup ? signupSchema : loginSchema;
  const form = useForm<SignupValues | LoginValues>({ resolver: zodResolver(schema), defaultValues: signup ? { name: '', email: '', password: '', confirmPassword: '' } : { email: '', password: '' } as LoginValues, mode: 'onBlur' });
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const { toast } = useToast();
  const password = form.watch('password') ?? '';
  const strength = [password.length >= 12, /[A-Z]/.test(password), /\d/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;

  async function submit(values: SignupValues | LoginValues) {
    try {
      const body = signup ? signupRequestPayload(values as SignupValues) : values as LoginValues;
      await api<SessionState>(`/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body: JSON.stringify(body) });
      await client.invalidateQueries({ queryKey: ['me'] });
      navigate('/dashboard', { replace: true });
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        form.setError('email' as never, { type: 'server', message: error.message } as never);
      } else if (error instanceof ApiError && error.status === 401) {
        form.setError('password' as never, { type: 'server', message: error.message || 'Email or password is incorrect.' } as never);
      } else {
        toast(error instanceof Error ? error.message : 'The request could not be completed.', 'error');
      }
    }
  }
  const errorText = (field: string) => (form.formState.errors as Record<string, { message?: string }>)[field]?.message;

  return <main className="grid min-h-screen lg:grid-cols-2">
    <aside className="hidden flex-col justify-between bg-action p-8 text-paper lg:flex">
      <Link to="/" className="font-semibold"><BrandSignature inverse /></Link>
      <div className="max-w-lg"><p className="font-mono text-xs uppercase tracking-widest text-paper/70">Requirements in context</p><h1 className="mt-4 text-2xl font-semibold tracking-tight">Make the assumptions visible before the proposal goes out.</h1><p className="mt-4 text-sm text-paper/80">A focused workbench for software services teams to inspect evidence, clarify scope, and prepare a draft for human review.</p></div>
      <p className="text-xs text-paper/70">Assessment prototype. Not officially endorsed by Cynbit Technologies.</p>
    </aside>
    <section className="flex items-center justify-center px-4 py-8 sm:px-8"><div className="w-full max-w-md">
      <Link to="/" className="mb-8 inline-flex font-semibold lg:hidden"><BrandSignature /></Link>
      <p className="font-mono text-xs uppercase tracking-widest text-muted-copy">{signup ? 'Create a workspace account' : 'Return to your workspace'}</p>
      <h2 className="mt-2 text-heading font-semibold text-emphasis">{signup ? 'Create your account' : 'Sign in'}</h2>
      <p className="mt-2 text-sm text-muted-copy">{signup ? 'Your projects and analyses are private to your account.' : 'Use the email and password associated with your account.'}</p>
      <form className="mt-6 space-y-4" noValidate onSubmit={form.handleSubmit((value) => void submit(value))}>
        {signup && <div><Label htmlFor="full-name">Full name</Label><Input id="full-name" autoComplete="name" className="mt-1" aria-invalid={Boolean(errorText('name'))} {...form.register('name')} />{errorText('name') && <p className="mt-1 text-xs text-error">{errorText('name')}</p>}</div>}
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" className="mt-1" aria-invalid={Boolean(errorText('email'))} {...form.register('email')} />{errorText('email') && <p className="mt-1 text-xs text-error">{errorText('email')}</p>}</div>
        <div><Label htmlFor="password">Password</Label><div className="relative mt-1"><Input id="password" type={showPassword ? 'text' : 'password'} autoComplete={signup ? 'new-password' : 'current-password'} className="pr-8" aria-invalid={Boolean(errorText('password'))} {...form.register('password')} /><Button type="button" size="icon" variant="ghost" className="absolute right-0 top-0" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword((old) => !old)}>{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</Button></div>{errorText('password') && <p className="mt-1 text-xs text-error">{errorText('password')}</p>}
          {signup && <div className="mt-2"><div className="flex gap-1" aria-label={`Password strength ${strength} of 4`}>{[0,1,2,3].map((index) => <span className={`h-1 flex-1 rounded-pill ${index < strength ? 'bg-action' : 'bg-line'}`} key={index} />)}</div><p className="mt-1 text-xs text-muted-copy">Use at least 12 characters, a capital letter, a number, and a symbol.</p></div>}
        </div>
        {signup && <div><Label htmlFor="confirm-password">Confirm password</Label><Input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" className="mt-1" aria-invalid={Boolean(errorText('confirmPassword'))} {...form.register('confirmPassword')} />{errorText('confirmPassword') && <p className="mt-1 text-xs text-error">{errorText('confirmPassword')}</p>}</div>}
        <Button className="w-full" type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <><LoaderCircle size={16} className="animate-spin" />{signup ? 'Creating account' : 'Signing in'}</> : signup ? 'Create account' : 'Sign in'}</Button>
      </form>
      <p className="mt-4 text-sm text-muted-copy">{signup ? 'Already have an account?' : 'New to the workspace?'} <Link className="font-medium text-copy underline decoration-transparent underline-offset-4 hover:decoration-copy" to={signup ? '/login' : '/signup'}>{signup ? 'Sign in' : 'Create an account'}</Link></p>
    </div></section>
  </main>;
}
