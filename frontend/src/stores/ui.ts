import { create } from 'zustand';

type UIState = {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  projectSearch: string;
  setProjectSearch: (value: string) => void;
  projectStatus: string;
  setProjectStatus: (value: string) => void;
  requirementSortDescending: boolean;
  setRequirementSortDescending: (value: boolean) => void;
  riskSeverity: string;
  setRiskSeverity: (value: string) => void;
  riskCategory: string;
  setRiskCategory: (value: string) => void;
};

export const useUIStore = create<UIState>((set) => ({
  mobileSidebarOpen: false,
  setMobileSidebarOpen: (mobileSidebarOpen) => set({ mobileSidebarOpen }),
  projectSearch: '',
  setProjectSearch: (projectSearch) => set({ projectSearch }),
  projectStatus: 'all',
  setProjectStatus: (projectStatus) => set({ projectStatus }),
  requirementSortDescending: false,
  setRequirementSortDescending: (requirementSortDescending) => set({ requirementSortDescending }),
  riskSeverity: 'All',
  setRiskSeverity: (riskSeverity) => set({ riskSeverity }),
  riskCategory: 'All',
  setRiskCategory: (riskCategory) => set({ riskCategory }),
}));
