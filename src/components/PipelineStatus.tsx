'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Eye,
  Palette,
  FileText,
  Video,
  Wand2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { usePipelineStore } from '@/lib/store';
import type { PipelineStepStatus } from '@/lib/types';

const stepConfig = [
  { key: 'scraping', label: 'Scraping', icon: Search, color: 'from-blue-500 to-cyan-500' },
  { key: 'vision', label: 'Vision', icon: Eye, color: 'from-cyan-500 to-teal-500' },
  { key: 'background', label: 'Background', icon: Palette, color: 'from-teal-500 to-green-500' },
  { key: 'content', label: 'Content', icon: FileText, color: 'from-green-500 to-emerald-500' },
  { key: 'video', label: 'Video', icon: Video, color: 'from-emerald-500 to-lime-500' },
  { key: 'assembly', label: 'Assembly', icon: Wand2, color: 'from-lime-500 to-yellow-500' },
] as const;

export default function PipelineStatus() {
  const { steps, costs, status } = usePipelineStore();

  const getStatusColor = (status: PipelineStepStatus['status']) => {
    switch (status) {
      case 'running':
        return 'border-blue-500 bg-blue-500/10';
      case 'success':
        return 'border-green-500 bg-green-500/10';
      case 'failed':
        return 'border-red-500 bg-red-500/10';
      case 'retrying':
        return 'border-yellow-500 bg-yellow-500/10';
      default:
        return 'border-gray-600 bg-gray-700/30';
    }
  };

  const getStatusIcon = (status: PipelineStepStatus['status']) => {
    switch (status) {
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'retrying':
        return <AlertCircle className="w-5 h-5 text-yellow-400 animate-pulse" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: PipelineStepStatus['status']) => {
    const colors = {
      pending: 'bg-gray-600 text-gray-200',
      running: 'bg-blue-600 text-blue-100',
      success: 'bg-green-600 text-green-100',
      failed: 'bg-red-600 text-red-100',
      retrying: 'bg-yellow-600 text-yellow-100',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const formatDuration = (startedAt: string | null, completedAt: string | null) => {
    if (!startedAt) return null;
    const start = new Date(startedAt).getTime();
    const end = completedAt ? new Date(completedAt).getTime() : Date.now();
    const duration = Math.floor((end - start) / 1000);
    return `${duration}s`;
  };

  const getCostForStep = (stepKey: string): number => {
    const costMap: Record<string, keyof typeof costs> = {
      scraping: 'apify',
      vision: 'openai',
      background: 'removebg',
      content: 'mistral',
      video: 'vidgo',
      assembly: 'shotstack',
    };
    const costKey = costMap[stepKey];
    return costs[costKey] || 0;
  };

  const totalProgress = useMemo(() => {
    const stepValues = Object.values(steps);
    if (stepValues.length === 0) return 0;
    const sum = stepValues.reduce((acc, step) => acc + (step?.progress || 0), 0);
    return Math.round(sum / stepValues.length);
  }, [steps]);

  if (status === 'idle') {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <Video className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Enter a product URL to start generating</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gray-700/30 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-300">Overall Progress</span>
          <span className="text-sm font-bold text-purple-400">{totalProgress}%</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${totalProgress}%` }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
            className="h-full bg-gradient-to-r from-purple-500 to-pink-600 rounded-full"
          />
        </div>
      </div>

      <div className="space-y-4">
        {stepConfig.map((config, index) => {
          const stepData = steps[config.key];
          const stepStatus = stepData?.status || 'pending';
          const Icon = config.icon;
          const cost = getCostForStep(config.key);
          const duration = formatDuration(stepData?.startedAt || null, stepData?.completedAt || null);

          return (
            <motion.div
              key={config.key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`border-2 rounded-lg p-4 transition-all duration-300 ${getStatusColor(
                stepStatus
              )}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-gradient-to-br ${config.color}`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold">{config.label}</h3>
                      {getStatusBadge(stepStatus)}
                      {getStatusIcon(stepStatus)}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      {duration && (
                        <span className="text-gray-400 flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {duration}
                        </span>
                      )}
                      {cost > 0 && (
                        <span className="text-green-400 font-semibold">${cost.toFixed(4)}</span>
                      )}
                    </div>
                  </div>

                  {stepData && stepData.progress > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">Progress</span>
                        <span className="text-xs font-semibold text-gray-300">
                          {stepData.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${stepData.progress}%` }}
                          transition={{ duration: 0.3 }}
                          className={`h-full bg-gradient-to-r ${config.color}`}
                        />
                      </div>
                    </div>
                  )}

                  {stepData?.error && (
                    <div className="mt-2 px-3 py-2 bg-red-900/30 border border-red-500/50 rounded text-sm text-red-200">
                      {stepData.error}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {costs.total > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg p-4"
        >
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold">Total Cost</span>
            <span className="text-2xl font-bold text-green-400">${costs.total.toFixed(4)}</span>
          </div>
        </motion.div>
      )}
    </div>
  );
}