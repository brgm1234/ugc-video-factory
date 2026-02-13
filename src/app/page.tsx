'use client';

import { useState, useEffect, useRef } from 'react';
import { usePipelineStore } from '@/lib/store';
import { PipelineLog } from '@/lib/types';

type StepName = 'scraping' | 'vision' | 'background' | 'content' | 'video' | 'assembly';

const stepLabels: Record<StepName, string> = {
  scraping: 'Product Scraping',
  vision: 'Vision Analysis',
  background: 'Background Removal',
  content: 'Content Generation',
  video: 'Video Generation',
  assembly: 'Final Assembly',
};

const stepIcons: Record<StepName, string> = {
  scraping: '🔍',
  vision: '👁️',
  background: '✂️',
  content: '✍️',
  video: '🎬',
  assembly: '🎞️',
};

export default function HomePage() {
  const [productUrl, setProductUrl] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  
  const {
    status,
    logs,
    videoUrl,
    costs,
    currentStep,
    steps,
    addLog,
    setStatus,
    setVideoUrl,
    setCosts,
    setCurrentStep,
    updateStepStatus,
    reset,
  } = usePipelineStore();

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productUrl.trim()) {
      alert('Please enter a product URL');
      return;
    }

    reset();
    setIsRunning(true);
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

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleSSEMessage(data);
            } catch (error) {
              console.error('Error parsing SSE message:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Pipeline error:', error);
      setStatus('failed');
      addLog({
        timestamp: new Date().toISOString(),
        step: currentStep || 'scraping',
        level: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleSSEMessage = (message: any) => {
    switch (message.type) {
      case 'step_update':
        if (message.data.currentStep) {
          setCurrentStep(message.data.currentStep);
        }
        if (message.data.steps) {
          Object.entries(message.data.steps).forEach(([step, status]) => {
            updateStepStatus(step as StepName, status as any);
          });
        }
        if (message.data.status) {
          setStatus(message.data.status);
        }
        break;

      case 'log':
        addLog(message.data);
        break;

      case 'cost_update':
        if (message.data.costs) {
          setCosts(message.data.costs);
        }
        break;

      case 'complete':
        setStatus('success');
        if (message.data.videoUrl) {
          setVideoUrl(message.data.videoUrl);
        }
        if (message.data.costs) {
          setCosts(message.data.costs);
        }
        break;

      case 'error':
        setStatus('failed');
        break;

      case 'ping':
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const getStepStatusColor = (stepStatus: string) => {
    switch (stepStatus) {
      case 'success':
        return 'text-green-400 bg-green-400/10 border-green-400/30';
      case 'running':
        return 'text-blue-400 bg-blue-400/10 border-blue-400/30 animate-pulse';
      case 'failed':
        return 'text-red-400 bg-red-400/10 border-red-400/30';
      case 'retrying':
        return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30 animate-pulse';
      default:
        return 'text-gray-400 bg-gray-400/10 border-gray-400/30';
    }
  };

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-400';
      case 'warning':
        return 'text-yellow-400';
      case 'info':
        return 'text-blue-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🎬 UGC Video Factory
          </h1>
          <p className="text-xl text-gray-300">
            Transform product URLs into engaging UGC-style videos with AI
          </p>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 mb-8 border border-white/20">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="productUrl" className="block text-sm font-medium text-gray-200 mb-2">
                Product URL
              </label>
              <input
                type="url"
                id="productUrl"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://www.amazon.com/product/..."
                disabled={isRunning}
                className="w-full px-4 py-3 bg-white/5 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isRunning}
              className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-pink-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105"
            >
              {isRunning ? '🚀 Generating Video...' : '🎥 Generate Video'}
            </button>
          </form>
        </div>

        {status !== 'idle' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-4">Pipeline Progress</h2>
                <div className="space-y-4">
                  {(Object.entries(steps) as [StepName, any][]).map(([stepName, stepStatus]) => (
                    <div key={stepName} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{stepIcons[stepName]}</span>
                          <span className="text-white font-medium">{stepLabels[stepName]}</span>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStepStatusColor(stepStatus.status)}`}>
                          {stepStatus.status.toUpperCase()}
                        </span>
                      </div>
                      {stepStatus.status !== 'pending' && (
                        <div className="ml-11">
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                              style={{ width: `${stepStatus.progress}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-400 mt-1">
                            <span>{stepStatus.progress}%</span>
                            {stepStatus.error && <span className="text-red-400">{stepStatus.error}</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-4">💰 Cost Breakdown</h2>
                <div className="space-y-3">
                  {Object.entries(costs).map(([service, cost]) => (
                    <div key={service} className="flex justify-between items-center">
                      <span className="text-gray-300 capitalize">{service}</span>
                      <span className={`font-mono ${service === 'total' ? 'text-lg font-bold text-purple-400' : 'text-gray-400'}`}>
                        ${cost.toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {videoUrl && (
                <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                  <h2 className="text-2xl font-bold text-white mb-4">🎉 Generated Video</h2>
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <video
                      src={videoUrl}
                      controls
                      className="w-full h-full"
                      autoPlay
                    >
                      Your browser does not support the video tag.
                    </video>
                  </div>
                  <a
                    href={videoUrl}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 block w-full px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold rounded-lg hover:from-green-700 hover:to-emerald-700 focus:outline-none focus:ring-2 focus:ring-green-500 text-center transition-all duration-200 transform hover:scale-105"
                  >
                    📥 Download Video
                  </a>
                </div>
              )}

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 border border-white/20">
                <h2 className="text-2xl font-bold text-white mb-4">📋 Activity Log</h2>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-gray-400 text-sm">No logs yet...</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="text-sm border-l-2 border-white/20 pl-3 py-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-500 text-xs font-mono">
                            {new Date(log.timestamp).toLocaleTimeString()}
                          </span>
                          <span className={`font-semibold ${getLogLevelColor(log.level)}`}>
                            [{log.level.toUpperCase()}]
                          </span>
                          <span className="text-purple-400 text-xs">({log.step})</span>
                        </div>
                        <p className="text-gray-300 mt-1">{log.message}</p>
                        {log.data && (
                          <pre className="text-xs text-gray-500 mt-1 overflow-x-auto">
                            {JSON.stringify(log.data, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}