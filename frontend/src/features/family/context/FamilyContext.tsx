// src/features/family/context/FamilyContext.tsx
// Family context provider for managing current family state throughout the app

import React, { createContext, useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useFamilies } from '../hooks/useFamilies';
import { useFamilyById } from '../hooks/useFamilyById';
import { useSwitchFamily as useSwitchFamilyMutation } from '../hooks/useSwitchFamily';
import type { TenantRead } from '@/types/family';

/**
 * Family context value interface
 * Provides current family state and actions for switching families
 */
export interface FamilyContextValue {
  currentFamily: TenantRead | null;
  families: TenantRead[];
  isLoading: boolean;
  setCurrentFamily: (family: TenantRead | null) => void;
  switchFamily: (familyId: string) => void;
}

/**
 * Family context - provides family state to all children
 */
export const FamilyContext = createContext<FamilyContextValue | undefined>(undefined);

interface FamilyProviderProps {
  children: ReactNode;
}

/**
 * FamilyProvider component
 * Manages current family state based on URL parameter :familyId
 * Syncs family selection with localStorage for default preference
 * Provides switchFamily action that updates token and navigates
 */
export function FamilyProvider({ children }: FamilyProviderProps) {
  const { familyId } = useParams<{ familyId: string }>();
  const navigate = useNavigate();

  // Fetch all families user belongs to
  const { data: families = [], isLoading: isLoadingFamilies } = useFamilies();

  // Fetch current family details (validates membership)
  const { data: currentFamilyData, isLoading: isLoadingCurrent } = useFamilyById(familyId);

  // Local state for current family
  const [currentFamily, setCurrentFamily] = useState<TenantRead | null>(null);

  // Switch family mutation
  const switchFamilyMutation = useSwitchFamilyMutation();

  /**
   * Sync currentFamily state with data from useFamilyById
   * This happens when familyId URL param changes
   */
  useEffect(() => {
    if (currentFamilyData) {
      setCurrentFamily(currentFamilyData);

      // Store preferred family in localStorage for future default
      localStorage.setItem('preferred_family_id', currentFamilyData.id);
    }
  }, [currentFamilyData]);

  /**
   * Handle family switching
   * Calls the mutation which will update token and navigate
   */
  const switchFamily = (newFamilyId: string) => {
    switchFamilyMutation.mutate(newFamilyId);
  };

  const value: FamilyContextValue = {
    currentFamily,
    families,
    isLoading: isLoadingFamilies || isLoadingCurrent,
    setCurrentFamily,
    switchFamily,
  };

  return (
    <FamilyContext.Provider value={value}>
      {children}
    </FamilyContext.Provider>
  );
}
