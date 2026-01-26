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
import WelcomePage from "@/features/app/pages/WelcomePage";
import FamiliesPage from "@/features/family/pages/FamiliesPage";
import AuthTest from "../features/auth/__test-auth__";
import {
  TransactionsPage,
  AddTransactionPage,
  TransactionDetailPage,
} from '@/features/transactions/pages';
import { AccountsPage, FamilyAccountDetailPage } from '@/features/accounts/pages';

// Simple nested page placeholders (will be replaced with family-scoped versions)
function Dashboard() {
  return <div className="text-slate-700">Dashboard</div>;
}
function Budgets() {
  return <div className="text-slate-700">Budgets</div>;
}
function Reports() {
  return <div className="text-slate-700">Reports</div>;
}
function Settings() {
  return <div className="text-slate-700">Settings</div>;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

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
          {/* Family-scoped nested routes */}
          <Route index element={<Navigate to="welcome" replace />} />
          <Route path="welcome" element={<WelcomePage />} />

          {/* Transactions routes */}
          <Route path="transactions">
            <Route index element={<TransactionsPage />} />
            <Route path="new" element={<AddTransactionPage />} />
            <Route path=":transactionId" element={<TransactionDetailPage />} />
          </Route>

          {/* Accounts routes */}
          <Route path="accounts">
            <Route index element={<AccountsPage />} />
            <Route path=":accountId" element={<FamilyAccountDetailPage />} />
          </Route>
          <Route path="budgets" element={<Budgets />} />
          <Route path="reports" element={<Reports />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Catch-all - redirect to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
