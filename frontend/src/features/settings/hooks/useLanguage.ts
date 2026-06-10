// src/features/settings/hooks/useLanguage.ts
// Hooks for reading and changing the user's preferred UI language.
//
// Design: i18next itself is the global source of truth for the active language
// (useTranslation re-renders consumers on change), so there is no separate
// React context. These hooks layer persistence on top of i18next:
//   - changeLanguage: apply instantly + mirror to localStorage + PATCH backend
//   - useSyncUserLanguage: on login, pull the server value and apply it

import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import i18n, { SUPPORTED_LANGUAGES } from '@/i18n';
import { STORAGE_KEYS } from '@/lib/constants';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { getCurrentUser, updateLanguage } from '../api/userApi';
import type { LanguageCode } from '@/types';

// Query key for the current-user profile, namespaced like the rest of the app.
const CURRENT_USER_QUERY_KEY = ['currentUser'] as const;

/**
 * Apply a language locally: switch i18next (instant UI update) and persist to
 * localStorage so the choice survives a reload before any network call.
 */
function applyLanguageLocally(language: LanguageCode): void {
  i18n.changeLanguage(language);
  localStorage.setItem(STORAGE_KEYS.LANGUAGE, language);
}

/**
 * useLanguage
 * Exposes the active language and a setter that updates the UI optimistically
 * (instant) while syncing the choice to the backend in the background.
 */
export function useLanguage() {
  const queryClient = useQueryClient();
  // Subscribe to i18n via useTranslation so the returned currentLanguage stays
  // in sync and consumers re-render when the language changes.
  const { i18n: i18nInstance } = useTranslation();

  const {
    mutate: mutateLanguage,
    isPending,
    isError: didUpdateFail,
    reset: resetUpdateState,
  } = useMutation({
    mutationFn: (language: LanguageCode) => updateLanguage(language),
    // Seed the cache with the server's authoritative profile so a later
    // useSyncUserLanguage read does not flip the language back.
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, updatedUser);
    },
    // The local language is already applied optimistically, so the UI stays
    // consistent for this session. Log for developers, and expose
    // `didUpdateFail` so the UI can warn the user their choice was not saved
    // server-side — on the next load it would otherwise silently revert to the
    // (unchanged) server value with no explanation.
    onError: (error) => {
      console.error('Failed to persist language preference to server:', error);
    },
  });

  const changeLanguage = useCallback(
    (language: LanguageCode) => {
      // Clear any prior failure state so picking a language again starts clean
      // and a stale error banner does not linger after a successful retry.
      resetUpdateState();
      // Apply locally first for instant feedback, then persist to the backend.
      // If the PATCH fails the local choice still holds for this session and
      // will be re-synced from the server on the next load.
      applyLanguageLocally(language);
      mutateLanguage(language);
    },
    // mutate and reset (destructured here) are stable across renders — React
    // Query guarantees their reference identity, so this callback is created
    // once rather than on every render.
    [mutateLanguage, resetUpdateState]
  );

  return {
    currentLanguage: i18nInstance.language as LanguageCode,
    changeLanguage,
    isUpdating: isPending,
    // True when the most recent PATCH /users/me failed; the local choice still
    // applied, but it was not persisted to the backend.
    didUpdateFail,
    // Dismiss the failure state (e.g. when the user closes the error banner).
    dismissUpdateError: resetUpdateState,
  };
}

/**
 * useSyncUserLanguage
 * Fetches the user's saved language from the backend once authenticated and
 * applies it when it differs from the active one. This is what lets a returning
 * user on a fresh device pick up the language they previously chose. Call this
 * once high in the authenticated tree (AppShell).
 */
export function useSyncUserLanguage() {
  const { isAuthenticated } = useAuth();

  const currentUserQuery = useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: getCurrentUser,
    enabled: isAuthenticated,
  });

  const serverLanguage = currentUserQuery.data?.language;

  useEffect(() => {
    // Only override the local language when the server has a valid, different
    // value — avoids needless re-renders and respects an in-session change the
    // user just made (which already updated the cache via the mutation).
    if (
      serverLanguage &&
      SUPPORTED_LANGUAGES.includes(serverLanguage) &&
      serverLanguage !== i18n.language
    ) {
      applyLanguageLocally(serverLanguage);
    }
  }, [serverLanguage]);

  return currentUserQuery;
}
