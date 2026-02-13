'use client';

import { motion } from 'framer-motion';
import { Download, Video, TrendingUp, DollarSign, Star, Users, Target } from 'lucide-react';
import { usePipelineStore } from '@/lib/store';

export default function ResultsView() {
  const { videoUrl, costs, status } = usePipelineStore();

  const mockAngles = [
    {
      id: '1',
      title: 'Problem-Solution Hook',
      hook: 'Tired of [problem]? Here\'s the solution you\'ve been waiting for!',
      script: 'Full script content here...',
      targetAudience: 'Young professionals, 25-35',
      tone: 'Energetic and relatable',
      qualityScore: 92,
      estimatedEngagement: 8.5,
    },
    {
      id: '2',
      title: 'Transformation Story',
      hook: 'Watch how this product transformed my [aspect of life]',
      script: 'Full script content here...',
      targetAudience: 'Health-conscious consumers, 30-45',
      tone: 'Authentic and inspiring',
      qualityScore: 88,
      estimatedEngagement: 7.8,
    },
    {
      id: '3',
      title: 'Social Proof',
      hook: 'Everyone\'s talking about this - here\'s why',
      script: 'Full script content here...',
      targetAudience: 'Trend-followers, 18-30',
      tone: 'Casual and conversational',
      qualityScore: 85,
      estimatedEngagement: 7.2,
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 80) return 'text-blue-400';
    if (score >= 70) return 'text-yellow-400';
    return 'text-orange-400';
  };

  if (status === 'idle' || status === 'running') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Video className="w-16 h-16 text-gray-600 mb-4" />
        <p className="text-gray-400 text-lg">
          {status === 'idle'
            ? 'Results will appear here after generation'
            : 'Generating your video...'}
        </p>
      </div>
    );
  }

  if (status === 'failed') {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Video className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-red-400 text-lg mb-2">Video generation failed</p>
          <p className="text-gray-400">Please check the logs for more details</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {videoUrl && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gray-700/30 rounded-lg p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Video className="w-6 h-6 text-purple-400" />
              Final Video
            </h2>
            <a
              href={videoUrl}
              download
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-600 rounded-lg font-semibold hover:from-purple-600 hover:to-pink-700 transition-all duration-200 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
          </div>
          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            <video
              src={videoUrl}
              controls
              className="w-full h-full"
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Crect fill='%23000000' width='1920' height='1080'/%3E%3C/svg%3E"
            >
              Your browser does not support the video tag.
            </video>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gray-700/30 rounded-lg p-6"
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Target className="w-6 h-6 text-purple-400" />
          Marketing Angles
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mockAngles.map((angle, index) => (
            <motion.div
              key={angle.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 + index * 0.1 }}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 hover:border-purple-500/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-lg">{angle.title}</h3>
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                  <span className={`text-sm font-bold ${getScoreColor(angle.qualityScore)}`}>
                    {angle.qualityScore}
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="bg-purple-900/30 border border-purple-500/30 rounded p-2">
                  <p className="text-purple-200 italic">"{angle.hook}"</p>
                </div>

                <div className="flex items-center gap-2 text-gray-400">
                  <Users className="w-4 h-4" />
                  <span>{angle.targetAudience}</span>
                </div>

                <div className="flex items-center gap-2 text-gray-400">
                  <TrendingUp className="w-4 h-4" />
                  <span>Est. Engagement: {angle.estimatedEngagement}%</span>
                </div>

                <div className="text-gray-400">
                  <span className="font-medium">Tone:</span> {angle.tone}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-gray-700/30 rounded-lg p-6"
      >
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Cost Breakdown
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: 'Apify', value: costs.apify },
            { label: 'OpenAI', value: costs.openai },
            { label: 'Mistral', value: costs.mistral },
            { label: 'VidGo', value: costs.vidgo },
            { label: 'Shotstack', value: costs.shotstack },
            { label: 'RemoveBG', value: costs.removebg },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 + index * 0.05 }}
              className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center"
            >
              <div className="text-gray-400 text-sm mb-1">{item.label}</div>
              <div className="text-green-400 font-bold text-lg">${item.value.toFixed(4)}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
          <span className="text-xl font-semibold">Total Cost</span>
          <span className="text-2xl font-bold text-green-400">${costs.total.toFixed(4)}</span>
        </div>
      </motion.div>
    </div>
  );
}