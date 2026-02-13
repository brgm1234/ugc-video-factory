import { create } from 'zustand';
import { PipelineStepStatus, PipelineSteps, CostBreakdown, PipelineLog } from '@/lib/types';


interface PipelineStore {
  status: 'idle' | 'running' | 'success' | 'failed';
  progress: number;
  logs: PipelineLog[];
  messages: string[];
  videoUrl: string | null;
  costs: CostBreakdown;
  currentStep: StepName | null;
  steps: PipelineSteps;
  
  setStatus: (status: 'idle' | 'running' | 'success' | 'failed') => void;
  setProgress: (progress: number) => void;
  addLog: (log: PipelineLog) => void;
  setMessages: (messages: string[]) => void;
  addMessage: (message: string) => void;
  setVideoUrl: (url: string | null) => void;
  setCosts: (costs: Partial<CostBreakdown>) => void;
  setCurrentStep: (step: StepName | null) => void;
  setSteps: (steps: Partial<PipelineSteps>) => void;
  updateStepStatus: (step: StepName, status: Partial<PipelineStepStatus>) => void;
  reset: () => void;
}

const initialStepStatus: PipelineStepStatus = {
  status: 'pending',
  progress: 0,
  startedAt: null,
  completedAt: null,
  error: null,
};

const initialSteps: PipelineSteps = {
  scraping: { ...initialStepStatus },
  vision: { ...initialStepStatus },
  background: { ...initialStepStatus },
  content: { ...initialStepStatus },
  video: { ...initialStepStatus },
  assembly: { ...initialStepStatus },
};

const initialCosts: CostBreakdown = {
  apify: 0,
  openai: 0,
  mistral: 0,
  vidgo: 0,
  shotstack: 0,
  removebg: 0,
  total: 0,
};

export const usePipelineStore = create<PipelineStore>((set) => ({
  status: 'idle',
  progress: 0,
  logs: [],
  messages: [],
  videoUrl: null,
  costs: initialCosts,
  currentStep: null,
  steps: initialSteps,

  setStatus: (status) => set({ status }),

  setProgress: (progress) => set({ progress }),

  addLog: (log) => set((state) => ({ 
    logs: [...state.logs, log],
  })),

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message],
  })),

  setVideoUrl: (videoUrl) => set({ videoUrl }),

  setCosts: (costs) => set((state) => {
    const updatedCosts = { ...state.costs, ...costs };
    updatedCosts.total = Object.entries(updatedCosts)
      .filter(([key]) => key !== 'total')
      .reduce((sum, [, value]) => sum + value, 0);
    return { costs: updatedCosts };
  }),

  setCurrentStep: (currentStep) => set({ currentStep }),

  setSteps: (steps) => set((state) => ({
    steps: { ...state.steps, ...steps },
  })),

  updateStepStatus: (step, status) => set((state) => ({
    steps: {
      ...state.steps,
      [step]: { ...state.steps[step], ...status },
    },
  })),

  reset: () => set({
    status: 'idle',
    progress: 0,
    logs: [],
    messages: [],
    videoUrl: null,
    costs: initialCosts,
    currentStep: null,
    steps: initialSteps,
  }),
}));