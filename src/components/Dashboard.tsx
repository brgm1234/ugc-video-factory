'use client';

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePipelineStore } from '@/lib/store';
import PipelineStatus from './PipelineStatus';
import JokerChat from './JokerChat';
import ResultsView from './ResultsView';
import LogsView from './LogsView';

type Tab = 'pipeline' | 'chat' | 'results' | 'logs';

export default function Dashboard() {
  const [productUrl, setProductUrl] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('pipeline');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    status,
    setStatus,
    setProgress,
    addLog,
    setMessages,
    setVideoUrl,
    setCosts,
    setCurrentStep,
    setSteps,
    reset,
  } = usePipelineStore();

  const validateUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleGenerate = async () => {
    if (!productUrl.trim()) {
      setError('Please enter a product URL');
      return;
    }

    if (!validateUrl(productUrl)) {
      setError('Please enter a valid URL');
      return;
    }

    setError(null);
    setIsGenerating(true);
    reset();
    setStatus('running');

    try {
      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productUrl }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data: ')) continue;

          const data = line.slice(6);

          if (data === '[DONE]') {
            setStatus('success');
            setIsGenerating(false);
            continue;
          }

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case 'status':
                setStatus(event.status);
                break;

              case 'progress':
                setProgress(event.progress);
                break;

              case 'step':
                setCurrentStep(event.step);
                if (event.stepData) {
                  setSteps((prev) => ({
                    ...prev,
                    [event.step]: event.stepData,
                  }));
                }
                break;

              case 'log':
                addLog({
                  timestamp: event.timestamp || new Date().toISOString(),
                  step: event.step || 'system',
                  level: event.level || 'info',
                  message: event.message,
                  data: event.data,
                });
                break;

              case 'message':
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `${Date.now()}-${Math.random()}`,
                    type: event.messageType || 'info',
                    content: event.content,
                    timestamp: event.timestamp || new Date().toISOString(),
                  },
                ]);
                break;

              case 'video':
                setVideoUrl(event.url);
                break;

              case 'costs':
                setCosts(event.costs);
                break;

              case 'error':
                setError(event.message || 'An error occurred');
                setStatus('failed');
                addLog({
                  timestamp: new Date().toISOString(),
                  step: event.step || 'system',
                  level: 'error',
                  message: event.message,
                  data: event.data,
                });
                break;
            }
          } catch (parseError) {
            console.error('Failed to parse SSE event:', parseError);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to generate video';
      setError(message);
      setStatus('failed');
      addLog({
        timestamp: new Date().toISOString(),
        step: 'system',
        level: 'error',
        message,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'chat', label: 'Joker Chat' },
    { id: 'results', label: 'Results' },
    { id: 'logs', label: 'Logs' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            UGC Video Factory
          </h1>
          <p className="text-gray-400">Transform product URLs into engaging UGC videos</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-800 rounded-lg p-6 mb-6 shadow-xl"
        >
          <div className="flex gap-4">
            <div className="flex-1">
              <label htmlFor="productUrl" className="block text-sm font-medium mb-2">
                Product URL
              </label>
              <input
                id="productUrl"
                type="text"
                value={productUrl}
                onChange={(e) => {
                  setProductUrl(e.target.value);
                  setError(null);
                }}
                placeholder="https://example.com/product"
                disabled={isGenerating}
                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !productUrl.trim()}
                className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2 shadow-lg"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 px-4 py-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200"
            >
              {error}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-gray-800 rounded-lg shadow-xl overflow-hidden"
        >
          <div className="border-b border-gray-700">
            <nav className="flex">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 font-medium transition-colors relative ${
                    activeTab === tab.id
                      ? 'text-purple-400'
                      : 'text-gray-400 hover:text-gray-300'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-500"
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                    />
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'pipeline' && <PipelineStatus />}
            {activeTab === 'chat' && <JokerChat />}
            {activeTab === 'results' && <ResultsView />}
            {activeTab === 'logs' && <LogsView />}
          </div>
        </motion.div>
      </div>
    </div>
  );
}