'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export interface StudioInfoDraft {
  studio_name: string;
  business_type: string;
  phone: string;
  country: string;
  timezone: string;
  currency: string;
  website: string;
}

export interface BranchDraft {
  name: string;
  address: string;
  country: string;
  state: string;
  city: string;
  postal_code: string;
  phone: string;
}

export interface MembershipPlanDraft {
  name: string;
  plan_type: string;
  duration_days: number;
  price: number;
  description: string;
}

export interface MembershipDraft {
  plans: MembershipPlanDraft[];
  selectedTemplates: number[];
  showCustom: boolean;
}

export interface StaffDraft {
  full_name: string;
  role: string;
  email: string;
  phone: string;
}

interface OnboardingDraftState {
  studioInfo: StudioInfoDraft;
  branches: BranchDraft[];
  memberships: MembershipDraft;
  staff: StaffDraft[];
  setStudioInfo: (draft: Partial<StudioInfoDraft>) => void;
  replaceStudioInfo: (draft: StudioInfoDraft) => void;
  setBranches: (branches: BranchDraft[]) => void;
  setMemberships: (draft: MembershipDraft) => void;
  setStaff: (staff: StaffDraft[]) => void;
  clearStudioInfo: () => void;
  clearBranches: () => void;
  clearMemberships: () => void;
  clearStaff: () => void;
  resetAll: () => void;
}

const defaultStudioInfo: StudioInfoDraft = {
  studio_name: '',
  business_type: 'gym',
  phone: '',
  country: '',
  timezone: '',
  currency: '',
  website: '',
};

const defaultBranch: BranchDraft = {
  name: '',
  address: '',
  country: '',
  state: '',
  city: '',
  postal_code: '',
  phone: '',
};

const defaultMemberships: MembershipDraft = {
  plans: [],
  selectedTemplates: [],
  showCustom: false,
};

const defaultStaff: StaffDraft[] = [
  {
    full_name: '',
    role: 'trainer',
    email: '',
    phone: '',
  },
];

export function createEmptyBranchDraft(overrides?: Partial<BranchDraft>): BranchDraft {
  return {
    ...defaultBranch,
    ...overrides,
  };
}

export const useOnboardingStore = create<OnboardingDraftState>()(
  persist(
    (set) => ({
      studioInfo: defaultStudioInfo,
      branches: [defaultBranch],
      memberships: defaultMemberships,
      staff: defaultStaff,
      setStudioInfo: (draft) => set((state) => ({ studioInfo: { ...state.studioInfo, ...draft } })),
      replaceStudioInfo: (draft) => set({ studioInfo: draft }),
      setBranches: (branches) => set({ branches: branches.length ? branches : [defaultBranch] }),
      setMemberships: (draft) => set({ memberships: draft }),
      setStaff: (staff) => set({ staff: staff.length ? staff : defaultStaff }),
      clearStudioInfo: () => set({ studioInfo: defaultStudioInfo }),
      clearBranches: () => set({ branches: [defaultBranch] }),
      clearMemberships: () => set({ memberships: defaultMemberships }),
      clearStaff: () => set({ staff: defaultStaff }),
      resetAll: () =>
        set({
          studioInfo: defaultStudioInfo,
          branches: [defaultBranch],
          memberships: defaultMemberships,
          staff: defaultStaff,
        }),
    }),
    {
      name: 'onboarding-drafts',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({
        studioInfo: state.studioInfo,
        branches: state.branches,
        memberships: state.memberships,
        staff: state.staff,
      }),
    },
  ),
);
