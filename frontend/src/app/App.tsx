import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from '../lib/api';
import { useSession } from '../hooks/useSession';
import { Button } from '../components/ui/button';
import { ErrorState, LoadingState } from '../components/shared/workbench';
import LandingPage from '../features/auth/LandingPage';
import AuthPage from '../features/auth/AuthPage';
const OverviewPage = lazy(() => import('../features/projects/OverviewPage'));
const ProjectsPage = lazy(() => import('../features/projects/ProjectsPage'));
const AnalysisWizard = lazy(() => import('../features/analysis/AnalysisWizard'));
const AnalysisPage = lazy(() => import('../features/analysis/AnalysisPage'));
const AnalyticsPage = lazy(() => import('../features/analytics/AnalyticsPage'));
const ProposalLibraryPage = lazy(() => import('../features/proposal/ProposalLibraryPage'));
const ProposalPage = lazy(() => import('../features/proposal/ProposalPage'));
const SettingsHelpPage = lazy(() => import('../features/settings/SettingsHelpPage'));
import { Shell } from './Shell';

function PageLoader({ children }: { children: ReactNode }) {
  return <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-8"><LoadingState label="Loading page" /></main>}>{children}</Suspense>;
}

function ProtectedLayout() {
  const session = useSession();
  const location = useLocation();
  if (session.isLoading) return <main className="mx-auto max-w-2xl px-4 py-8"><LoadingState label="Checking your session" /></main>;
  if (session.error) {
    if (session.error instanceof ApiError && session.error.status === 401) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return <main className="mx-auto max-w-2xl px-4 py-8"><ErrorState message={session.error instanceof Error ? session.error.message : 'Could not verify your session.'} onRetry={() => void session.refetch()} /><Button className="mt-3" variant="outline" onClick={() => window.location.assign('/login')}>Sign in</Button></main>;
  }
  if (!session.data?.id) return <Navigate to="/login" replace />;
  return <Shell user={session.data}><Outlet /></Shell>;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/signup" element={<AuthPage mode="signup" />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/help" element={<PageLoader><SettingsHelpPage page="help" /></PageLoader>} />
    <Route element={<ProtectedLayout />}>
      <Route path="/dashboard" element={<PageLoader><OverviewPage /></PageLoader>} />
      <Route path="/projects" element={<PageLoader><ProjectsPage /></PageLoader>} />
      <Route path="/projects/new" element={<PageLoader><AnalysisWizard /></PageLoader>} />
      <Route path="/projects/:id/analyze" element={<PageLoader><AnalysisWizard /></PageLoader>} />
      <Route path="/analyses" element={<PageLoader><AnalyticsPage /></PageLoader>} />
      <Route path="/analytics" element={<PageLoader><AnalyticsPage /></PageLoader>} />
      <Route path="/analyses/:id" element={<PageLoader><AnalysisPage /></PageLoader>} />
      <Route path="/proposals" element={<PageLoader><ProposalLibraryPage /></PageLoader>} />
      <Route path="/proposals/:id" element={<PageLoader><ProposalPage /></PageLoader>} />
      <Route path="/settings" element={<PageLoader><SettingsHelpPage page="settings" /></PageLoader>} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
