import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingGear } from '@/components/LoadingGear';
import { AppShell } from '@/components/layout/AppShell';

const HomePage = lazy(() => import('@/pages/HomePage'));
const ArenaIndexPage = lazy(() => import('@/pages/ArenaIndexPage'));
const BattlePage = lazy(() => import('@/pages/BattlePage'));
const LeaderboardPage = lazy(() => import('@/pages/LeaderboardPage'));
const PerInputLeaderboardPage = lazy(() => import('@/pages/PerInputLeaderboardPage'));
const BotProfilePage = lazy(() => import('@/pages/BotProfilePage'));
const HeadToHeadPage = lazy(() => import('@/pages/HeadToHeadPage'));
const TournamentsListPage = lazy(() => import('@/pages/TournamentsListPage'));
const TournamentBracketPage = lazy(() => import('@/pages/TournamentBracketPage'));
const SubmitPage = lazy(() => import('@/pages/SubmitPage'));
const MyFightersPage = lazy(() => import('@/pages/MyFightersPage'));
const HallOfFamePage = lazy(() => import('@/pages/HallOfFamePage'));
const AchievementsPage = lazy(() => import('@/pages/AchievementsPage'));
const EventsFeedPage = lazy(() => import('@/pages/EventsFeedPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const DesignSystemPage = lazy(() => import('@/pages/DesignSystemPage'));

const VISUAL_REGRESSION_ENABLED = import.meta.env.VITE_ENABLE_VISUAL_REGRESSION === 'true';

function RouteFallback() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
      <LoadingGear size="h-32 w-32" label="Loading…" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <AppShell forceTheme="dark">
                  <HomePage />
                </AppShell>
              }
            />
            <Route
              path="/arena"
              element={
                <AppShell forceTheme="dark" scanLines>
                  <ArenaIndexPage />
                </AppShell>
              }
            />
            <Route
              path="/arena/:battleId"
              element={
                <AppShell forceTheme="dark" scanLines>
                  <BattlePage />
                </AppShell>
              }
            />
            <Route
              path="/submit"
              element={
                <AppShell forceTheme="dark">
                  <SubmitPage />
                </AppShell>
              }
            />
            <Route
              path="/me/fighters"
              element={
                <AppShell>
                  <MyFightersPage />
                </AppShell>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <AppShell>
                  <LeaderboardPage />
                </AppShell>
              }
            />
            <Route
              path="/leaderboard/inputs/:inputId"
              element={
                <AppShell>
                  <PerInputLeaderboardPage />
                </AppShell>
              }
            />
            <Route
              path="/bots/:botId"
              element={
                <AppShell>
                  <BotProfilePage />
                </AppShell>
              }
            />
            <Route
              path="/bots/:a/vs/:b"
              element={
                <AppShell>
                  <HeadToHeadPage />
                </AppShell>
              }
            />
            <Route
              path="/tournaments"
              element={
                <AppShell>
                  <TournamentsListPage />
                </AppShell>
              }
            />
            <Route
              path="/tournaments/:id"
              element={
                <AppShell>
                  <TournamentBracketPage />
                </AppShell>
              }
            />
            <Route
              path="/halloffame"
              element={
                <AppShell>
                  <HallOfFamePage />
                </AppShell>
              }
            />
            <Route
              path="/achievements"
              element={
                <AppShell>
                  <AchievementsPage />
                </AppShell>
              }
            />
            <Route
              path="/events"
              element={
                <AppShell>
                  <EventsFeedPage />
                </AppShell>
              }
            />
            {VISUAL_REGRESSION_ENABLED ? (
              <Route
                path="/dev/design-system"
                element={
                  <AppShell>
                    <DesignSystemPage />
                  </AppShell>
                }
              />
            ) : null}
            <Route
              path="*"
              element={
                <AppShell>
                  <NotFoundPage />
                </AppShell>
              }
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
