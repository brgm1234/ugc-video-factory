import { useState, useEffect, useRef } from 'react';
import { usePipelineStore } from '@/lib/store';
import { Play, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
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
  const eventSourceRef = useRef<EventSource | null>(null);
  
  const { setStatus, addLog, setProgress, setMessages, setVideoUrl } = usePipelineStore();

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const handleGenerateVideo = async () => {
    if (!productUrl.trim()) {
      setError('Please enter a product URL');
      return;
    }

    setError(null);
    setIsGenerating(true);
    setStatus('running');
    setProgress(0);
    setVideoUrl(null);
    setMessages([]);

    try {
      const response = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productUrl }),
      });

      if (!response.ok) {
        throw new Error('Failed to start pipeline');
      }

      const data = await response.json();
      const { sessionId } = data;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource(`/api/pipeline?sessionId=${sessionId}`);
      eventSourceRef.current = eventSource;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === 'status') {
          setStatus(data.status);
        } else if (data.type === 'progress') {
          setProgress(data.progress);
        } else if (data.type === 'log') {
          addLog({ timestamp: Date.now(), message: data.message, level: data.level || 'info' });
        } else if (data.type === 'message') {
          setMessages((prev) => [...prev, data.message]);
        } else if (data.type === 'video') {
          setVideoUrl(data.url);
        } else if (data.type === 'complete') {
          setStatus('completed');
          setIsGenerating(false);
          eventSource.close();
        } else if (data.type === 'error') {
          setStatus('failed');
          setError(data.message);
          setIsGenerating(false);
          eventSource.close();
        }
      };

      eventSource.onerror = () => {
        setStatus('failed');
        setError('Connection lost. Please try again.');
        setIsGenerating(false);
        eventSource.close();
      };
    } catch (err) {
      setStatus('failed');
      setError(err instanceof Error ? err.message : 'An error occurred');
      setIsGenerating(false);
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'chat', label: 'Chat' },
    { id: 'results', label: 'Results' },
    { id: 'logs', label: 'Logs' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white">
      <div className="max-w-7xl mx-auto p-6">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
            Joker Video Generator
          </h1>
          <p className="text-gray-400">Generate engaging product videos with AI</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="flex gap-3">
            <input
              type="text"
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder="Enter product URL (Amazon, eBay, etc.)"
              className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              disabled={isGenerating}
            />
            <button
              onClick={handleGenerateVideo}
              disabled={isGenerating || !productUrl.trim()}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
            >
              {isGenerating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Generating...</>
              ) : (
                <><Play className="w-5 h-5" /> Generate Video</>
              )}
            </button>
          </div>
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-red-400 text-sm mt-2"
            >
              {error}
            </motion.p>
          )}
        </motion.div>

        <div className="mb-6">
          <div className="flex gap-2 border-b border-gray-700">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 font-medium transition-all duration-200 relative ${
                  activeTab === tab.id
                    ? 'text-purple-400'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-600 to-pink-600"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <motion.div
          key={activeTab}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'pipeline' && <PipelineStatus />}
          {activeTab === 'chat' && <JokerChat />}
          {activeTab === 'results' && <ResultsView />}
          {activeTab === 'logs' && <LogsView />}
        </motion.div>
      </div>
    </div>
  );
}