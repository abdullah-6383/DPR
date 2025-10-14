'use client';

import { motion } from 'framer-motion';

export default function MinimalChart() {
  const data = [
    { label: 'Assessment Speed', value: 95, color: 'bg-blue-500' },
    { label: 'Accuracy Rate', value: 98, color: 'bg-green-500' },
    { label: 'Risk Detection', value: 87, color: 'bg-purple-500' },
    { label: 'Process Efficiency', value: 92, color: 'bg-cyan-500' }
  ];

  return (
    <div className="bg-gray-900/30 backdrop-blur-sm border border-gray-800 rounded-xl p-8">
      <div className="text-center mb-8">
        <h3 className="text-xl font-semibold text-white mb-2">System Performance</h3>
        <p className="text-gray-400 text-sm">Real-time analytics overview</p>
      </div>
      
      <div className="space-y-6">
        {data.map((item, index) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: index * 0.1 }}
            className="space-y-2"
          >
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm font-medium">{item.label}</span>
              <span className="text-white text-sm font-bold">{item.value}%</span>
            </div>
            
            <div className="relative">
              <div className="w-full bg-gray-800 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${item.value}%` }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: index * 0.1 + 0.3 }}
                  className={`h-2 rounded-full ${item.color} relative overflow-hidden`}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent"></div>
                </motion.div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
      
      {/* Mini Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-gray-800">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-400">1.2K+</div>
          <div className="text-xs text-gray-500">Projects Analyzed</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">8</div>
          <div className="text-xs text-gray-500">States Covered</div>
        </div>
      </div>
    </div>
  );
}