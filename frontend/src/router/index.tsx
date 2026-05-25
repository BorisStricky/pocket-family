// frontend/src/router/index.tsx
// Production router with family-scoped routes at /app/:familyId/*

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "../pages/landing_page";
import LoginPage from "../pages/login_page";
import SignupPage from "../pages/signup_page";
import LegalPage from "../pages/legal_page";
import AppShell from "@/components/ui/organisms/AppShell";
import DemoBanner from "@/components/ui/organisms/DemoBanner";
import DemoDisclaimerModal from "@/components/ui/organisms/DemoDisclaimerModal";
import { ProtectedRoute } from "../components/ProtectedRoute";
import FamilyGuard from "../components/FamilyGuard";
import { FamilyProvider } from "@/features/family/context/FamilyContext";
import AppRoot from "@/features/app/pages/AppRoot";

import FamiliesPage from "@/features/family/pages/FamiliesPage";
import {
  TransactionsPage,
  TransactionDetailPage,
} from '@/features/transactions/pages';
import { AcceptInvitePage } from '@/features/family/pages/AcceptInvitePage';
import {
  AccountsPage,
  EditAccountPage,
  FamilyAccountDetailPage,
  AllAccountsPage,
  GlobalAccountDetailPage,
} from '@/features/accounts/pages';
import { SettingsPage } from '@/features/settings/pages';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';
import { BudgetsPage } from '@/features/budgets/pages';
import { ReportsPage } from '@/features/reports/pages';
import { ImportCsvPage } from '@/features/transactions/pages';
import { ImportHistoryPage } from '@/features/imports/pages/ImportHistoryPage';

export default function AppRouter() {
  return (
    <BrowserRouter>
      {/* DemoBanner / DemoDisclaimerModal render nothing when VITE_DEMO_MODE
          is not set, so they are safe to mount unconditionally at the
          router root and appear on every public + protected page. */}
      <DemoBanner />
      <DemoDisclaimerModal />
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/legal" element={<LegalPage />} />

        {/* Accept invite page (public, no auth required) */}
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        {/* /app - redirect to default family */}
        <Route
          path="/app"
          element={
            <ProtectedRoute>
              <AppRoot />
            </ProtectedRoute>
          }
        />

        {/* /app/families - full family selector page */}
        <Route
          path="/app/families"
          element={
            <ProtectedRoute>
              <FamiliesPage />
            </ProtectedRoute>
          }
        />

        {/* Global accounts routes (MUST be before /app/:familyId/* to avoid conflicts) */}
        <Route
          path="/app/accounts/*"
          element={
            <ProtectedRoute>
              <AppShell globalMode />
            </ProtectedRoute>
          }
        >
          {/* Global account nested routes */}
          <Route index element={<AllAccountsPage />} />
          <Route path=":accountId" element={<GlobalAccountDetailPage />} />
        </Route>

        {/* /app/:familyId/* - family-scoped routes with guard */}
        <Route
          path="/app/:familyId/*"
          element={
            <ProtectedRoute>
              <FamilyGuard>
                <FamilyProvider>
                  <AppShell />
                </FamilyProvider>
              </FamilyGuard>
            </ProtectedRoute>
          }
        >
          {/* Family-scoped nested routes - default to dashboard */}
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />

          {/* Transactions routes */}
          <Route path="transactions">
            <Route index element={<TransactionsPage />} />
            <Route path=":transactionId" element={<TransactionDetailPage />} />
          </Route>

          {/* Accounts routes */}
          <Route path="accounts">
            <Route index element={<AccountsPage />} />
            <Route path=":accountId" element={<FamilyAccountDetailPage />} />
            <Route path=":accountId/edit" element={<EditAccountPage />} />
          </Route>
          <Route path="family" element={<Navigate to="../settings" replace />} />
          <Route path="budgets" element={<BudgetsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="import-csv" element={<ImportCsvPage />} />
          <Route path="imports" element={<ImportHistoryPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
