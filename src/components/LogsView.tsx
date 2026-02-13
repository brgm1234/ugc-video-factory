'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, AlertTriangle, XCircle, CheckCircle, Terminal } from 'lucide-react';
import { usePipelineStore } from '@/lib/store';
import type { PipelineLog } from '@/lib/types';

export default function LogsView() {
  const { logs } = usePipelineStore();
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const getLevelIcon = (level: PipelineLog['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Info className="w-4 h-4 text-blue-400" />;
    }
  };

  const getLevelColors = (level: PipelineLog['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-400 bg-green-900/20';
      case 'warn':
        return 'text-yellow-400 bg-yellow-900/20';
      case 'error':
        return 'text-red-400 bg-red-900/20';
      default:
        return 'text-blue-400 bg-blue-900/20';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const getStepColor = (step: string) => {
    const colors: Record<string, string> = {
      scraping: 'text-blue-400',
      vision: 'text-cyan-400',
      background: 'text-teal-400',
      content: 'text-green-400',
      video: 'text-emerald-400',
      assembly: 'text-lime-400',
      system: 'text-purple-400',
    };
    return colors[step] || 'text-gray-400';
  };

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
        >
          <Terminal className="w-16 h-16 text-gray-600 mb-4" />
        </motion.div>
        <p className="text-gray-400 text-lg">No logs yet</p>
        <p className="text-gray-500 text-sm mt-2">Logs will appear here during video generation</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg border border-gray-700">
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700 flex items-center gap-2">
        <Terminal className="w-5 h-5 text-purple-400" />
        <span className="font-semibold">Pipeline Logs</span>
        <span className="ml-auto text-sm text-gray-400">{logs.length} entries</span>
      </div>

      <div className="max-h-[600px] overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-2 font-mono text-sm">
          <AnimatePresence initial={false}>
            {logs.map((log, index) => (
              <motion.div
                key={`${log.timestamp}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className={`flex items-start gap-3 p-3 rounded ${getLevelColors(log.level)}`}
              >
                <div className="flex-shrink-0 mt-0.5">{getLevelIcon(log.level)}</div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-gray-400 text-xs">
                      {formatTimestamp(log.timestamp)}
                    </span>
                    <span className={`text-xs font-semibold ${getStepColor(log.step)}`}>
                      [{log.step.toUpperCase()}]
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        log.level === 'success'
                          ? 'bg-green-900/50 text-green-300'
                          : log.level === 'warn'
                          ? 'bg-yellow-900/50 text-yellow-300'
                          : log.level === 'error'
                          ? 'bg-red-900/50 text-red-300'
                          : 'bg-blue-900/50 text-blue-300'
                      }`}
                    >
                      {log.level.toUpperCase()}
                    </span>
                  </div>

                  <p className="text-gray-200 break-words">{log.message}</p>

                  {log.data && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400">
                        Show data
                      </summary>
                      <pre className="mt-2 p-2 bg-gray-950 rounded text-xs overflow-x-auto">
                        {JSON.stringify(log.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}