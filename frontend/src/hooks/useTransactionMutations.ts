// Placeholder hooks - to be implemented in Sprint 0 Step 3
// These allow the build to succeed while we implement the actual functionality

export function useUpdateTransaction(familyId: string) {
  return {
    mutateAsync: async () => {},
    isPending: false
  };
}

export function useDeleteTransaction(familyId: string) {
  return {
    mutateAsync: async () => {},
    isPending: false
  };
}

export function useDuplicateTransaction(familyId: string) {
  return {
    mutateAsync: async () => {},
    isPending: false
  };
}
