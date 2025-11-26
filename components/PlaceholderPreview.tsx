/**
 * Preview component to compare different placeholder styles
 * Temporary component for testing - can be removed after choosing a style
 */

import React, { useState } from 'react';
import { generatePlaceholder, PlaceholderStyle } from '../utils/placeholderGenerator';
import { THEME } from '../theme';

const SAMPLE_PROJECT = {
  title: 'The Last Frame',
  year: '2024',
  type: 'Narrative'
};

const STYLES: { name: string; value: PlaceholderStyle; description: string }[] = [
  { 
    name: 'Text Minimal', 
    value: 'text-minimal', 
    description: 'Clean typography with title, year, and GA initials' 
  },
  { 
    name: 'First Letter', 
    value: 'first-letter', 
    description: 'Large first letter with title below' 
  },
  { 
    name: 'Color Coded', 
    value: 'color-coded', 
    description: 'Different colors by project type (Narrative, Commercial, etc.)' 
  },
  { 
    name: 'Gradient', 
    value: 'gradient', 
    description: 'Modern gradient with decorative lines' 
  }
];

export const PlaceholderPreview: React.FC = () => {
  const [selectedStyle, setSelectedStyle] = useState<PlaceholderStyle>('text-minimal');
  const [customTitle, setCustomTitle] = useState(SAMPLE_PROJECT.title);
  const [customYear, setCustomYear] = useState(SAMPLE_PROJECT.year);
  const [customType, setCustomType] = useState(SAMPLE_PROJECT.type);

  const placeholder = generatePlaceholder({
    title: customTitle,
    year: customYear,
    type: customType,
    style: selectedStyle
  });

  return (
    <div className={`${THEME.header.paddingX} py-20 min-h-screen`}>
      <div className="max-w-7xl mx-auto">
        <h1 className={`${THEME.typography.h1} mb-4 text-white`}>Placeholder Thumbnail Preview</h1>
        <p className="text-gray-400 mb-12">Compare different placeholder styles for projects without images</p>

        {/* Style Selector */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => setSelectedStyle(style.value)}
              className={`p-6 rounded-lg border-2 transition text-left ${
                selectedStyle === style.value
                  ? 'border-white bg-white/10'
                  : 'border-white/20 hover:border-white/40'
              }`}
            >
              <h3 className="text-white font-semibold mb-2">{style.name}</h3>
              <p className="text-gray-400 text-sm">{style.description}</p>
            </button>
          ))}
        </div>

        {/* Large Preview */}
        <div className="mb-12">
          <h2 className="text-white text-xl mb-4 font-semibold">Preview: {STYLES.find(s => s.value === selectedStyle)?.name}</h2>
          <div className="w-full aspect-video bg-gray-900 rounded-lg overflow-hidden">
            <img 
              src={placeholder} 
              alt="Placeholder preview" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Customization Controls */}
        <div className="bg-white/5 p-8 rounded-lg mb-12">
          <h3 className="text-white text-lg mb-6 font-semibold">Customize</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-gray-400 text-sm mb-2">Project Title</label>
              <input 
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Year</label>
              <input 
                type="text"
                value={customYear}
                onChange={(e) => setCustomYear(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded px-4 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-gray-400 text-sm mb-2">Type</label>
              <select 
                value={customType}
                onChange={(e) => setCustomType(e.target.value)}
                className="w-full bg-black/50 border border-white/20 rounded px-4 py-2 text-white"
              >
                <option value="Narrative">Narrative</option>
                <option value="Commercial">Commercial</option>
                <option value="Music Video">Music Video</option>
                <option value="Documentary">Documentary</option>
                <option value="Uncategorized">Uncategorized</option>
              </select>
            </div>
          </div>
        </div>

        {/* Grid Preview (how it looks in portfolio) */}
        <div>
          <h3 className="text-white text-lg mb-4 font-semibold">In Grid View</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {STYLES.map((style) => {
              const gridPlaceholder = generatePlaceholder({
                title: customTitle,
                year: customYear,
                type: customType,
                style: style.value
              });
              
              return (
                <div 
                  key={style.value}
                  onClick={() => setSelectedStyle(style.value)}
                  className={`cursor-pointer group ${
                    selectedStyle === style.value ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <div className="w-full aspect-video bg-gray-900 overflow-hidden mb-3">
                    <img 
                      src={gridPlaceholder} 
                      alt={`${style.name} preview`}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </div>
                  <p className="text-white text-sm text-center">{style.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
