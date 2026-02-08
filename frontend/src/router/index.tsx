// frontend/src/router/index.tsx
// Production router with family-scoped routes at /app/:familyId/*

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import LandingPage from "../pages/landing_page";
import LoginPage from "../pages/login_page";
import SignupPage from "../pages/signup_page";
import AppShell from "@/components/ui/organisms/AppShell";
import { ProtectedRoute } from "../components/ProtectedRoute";
import FamilyGuard from "../components/FamilyGuard";
import { FamilyProvider } from "@/features/family/context/FamilyContext";
import AppRoot from "@/features/app/pages/AppRoot";

import FamiliesPage from "@/features/family/pages/FamiliesPage";
import AuthTest from "../features/auth/__test-auth__";
import {
  TransactionsPage,
  AddTransactionPage,
  TransactionDetailPage,
} from '@/features/transactions/pages';
import { AcceptInvitePage } from '@/features/family/pages/AcceptInvitePage';
import {
  AccountsPage,
  AddAccountPage,
  EditAccountPage,
  FamilyAccountDetailPage,
  AllAccountsPage,
  GlobalAccountDetailPage,
  GlobalAddAccountPage,
} from '@/features/accounts/pages';
import { SettingsPage } from '@/features/settings/pages';
import DashboardPage from '@/features/dashboard/pages/DashboardPage';

// Simple nested page placeholders (will be replaced with family-scoped versions)
function Budgets() {
  return <div className="text-slate-700">Budgets</div>;
}
function Reports() {
  return <div className="text-slate-700">Reports</div>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Accept invite page (public, no auth required) */}
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        {/* Test route for auth (remove in production) */}
        <Route path="/test-auth" element={<AuthTest />} />

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
          <Route path="new" element={<GlobalAddAccountPage />} />
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
            <Route path="new" element={<AddTransactionPage />} />
            <Route path=":transactionId" element={<TransactionDetailPage />} />
          </Route>

          {/* Accounts routes */}
          <Route path="accounts">
            <Route index element={<AccountsPage />} />
            <Route path="new" element={<AddAccountPage />} />
            <Route path=":accountId" element={<FamilyAccountDetailPage />} />
            <Route path=":accountId/edit" element={<EditAccountPage />} />
          </Route>
          <Route path="family" element={<Navigate to="../settings" replace />} />
          <Route path="budgets" element={<Budgets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        {/* Catch-all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
