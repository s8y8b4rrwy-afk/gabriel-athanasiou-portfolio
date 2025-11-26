/**
 * ==============================================================================
 *  THUMBNAIL PREVIEW & STORYBOOK
 * ==============================================================================
 * 
 *  Interactive preview page for testing procedural thumbnails.
 *  Gabriel can toggle variants, adjust settings, and see real-time previews.
 */

import React, { useState } from 'react';
import { ProceduralThumbnail } from '../ProceduralThumbnail';
import { ThumbnailVariant, getVariantsForType } from '../../utils/thumbnailGenerator';
import { THEME } from '../../theme';
import { CloseButton } from '../common/CloseButton';

interface PreviewProject {
  title: string;
  year: string;
  type: string;
}

const SAMPLE_PROJECTS: PreviewProject[] = [
  { title: 'The Last Dance', year: '2024', type: 'Narrative' },
  { title: 'Nike Air Max Campaign', year: '2024', type: 'Commercial' },
  { title: 'Electric Dreams', year: '2023', type: 'Music Video' },
  { title: 'Journey to the Arctic', year: '2023', type: 'Documentary' },
  { title: 'Apple Vision Pro Launch', year: '2024', type: 'Commercial' },
  { title: 'Midnight Runner', year: '2023', type: 'Narrative' },
  { title: 'Fashion Week Paris', year: '2024', type: 'Commercial' },
  { title: 'Underground Sounds', year: '2024', type: 'Music Video' },
];

export const ThumbnailPreviewView: React.FC = () => {
  const [selectedVariant, setSelectedVariant] = useState<ThumbnailVariant>('geometric');
  const [customTitle, setCustomTitle] = useState('Your Project Title');
  const [customYear, setCustomYear] = useState('2024');
  const [customType, setCustomType] = useState('Narrative');
  const [showCustom, setShowCustom] = useState(false);
  
  const variants: ThumbnailVariant[] = ['geometric', 'minimal', 'film-strip', 'grid', 'radial'];
  const types = ['Narrative', 'Commercial', 'Music Video', 'Documentary', 'Uncategorized'];

  return (
    <div className="min-h-screen bg-bg-main text-white animate-view-enter pb-20">
      <CloseButton to="/" />
      
      <div className={`${THEME.header.paddingX} pt-32 md:pt-40 max-w-7xl mx-auto`}>
        
        {/* Header */}
        <div className="mb-16">
          <h1 className={`${THEME.typography.h1} mb-4`}>Procedural Thumbnails</h1>
          <p className="text-text-muted text-lg max-w-3xl">
            Interactive preview for testing SVG thumbnail generation. Each thumbnail is deterministically generated 
            from project metadata—same input always produces same output. Perfect for projects without video links.
          </p>
        </div>

        {/* Controls */}
        <div className="mb-16 space-y-8">
          {/* Variant Selector */}
          <div>
            <label className={`${THEME.typography.meta} text-text-muted mb-4 block`}>
              Visual Variant
            </label>
            <div className="flex flex-wrap gap-3">
              {variants.map((variant) => (
                <button
                  key={variant}
                  onClick={() => setSelectedVariant(variant)}
                  className={`px-4 py-2 rounded-full text-xs uppercase tracking-wider transition ${THEME.animation.fast}
                    ${selectedVariant === variant 
                      ? 'bg-white text-black' 
                      : 'bg-white/10 text-white hover:bg-white/20'}`}
                >
                  {variant}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Thumbnail Generator */}
          <div className="border border-white/10 rounded-lg p-6 bg-white/5">
            <div className="flex items-center justify-between mb-6">
              <h3 className={`${THEME.typography.h3}`}>Custom Thumbnail</h3>
              <button
                onClick={() => setShowCustom(!showCustom)}
                className={`text-xs uppercase tracking-wider opacity-60 hover:opacity-100 transition`}
              >
                {showCustom ? 'Hide' : 'Show'}
              </button>
            </div>
            
            {showCustom && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="text-xs uppercase tracking-wider text-text-muted mb-2 block">
                      Title
                    </label>
                    <input
                      type="text"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm focus:border-white/50 focus:outline-none transition"
                      placeholder="Project Title"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs uppercase tracking-wider text-text-muted mb-2 block">
                      Year
                    </label>
                    <input
                      type="text"
                      value={customYear}
                      onChange={(e) => setCustomYear(e.target.value)}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm focus:border-white/50 focus:outline-none transition"
                      placeholder="2024"
                    />
                  </div>
                  
                  <div>
                    <label className="text-xs uppercase tracking-wider text-text-muted mb-2 block">
                      Type
                    </label>
                    <select
                      value={customType}
                      onChange={(e) => setCustomType(e.target.value)}
                      className="w-full bg-black/50 border border-white/20 rounded px-3 py-2 text-sm focus:border-white/50 focus:outline-none transition"
                    >
                      {types.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Custom Preview */}
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <ProceduralThumbnail
                    title={customTitle}
                    year={customYear}
                    type={customType}
                    variant={selectedVariant}
                    className="w-full h-full object-cover"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sample Gallery */}
        <div>
          <h2 className={`${THEME.typography.h2} mb-8`}>Sample Projects</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {SAMPLE_PROJECTS.map((project, index) => (
              <div 
                key={index}
                className="group animate-fade-in-up opacity-0"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
              >
                <div className="aspect-video bg-black rounded-lg overflow-hidden mb-4 border border-white/10 group-hover:border-white/30 transition">
                  <ProceduralThumbnail
                    title={project.title}
                    year={project.year}
                    type={project.type}
                    variant={selectedVariant}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-700 ease-expo"
                  />
                </div>
                
                <div>
                  <h3 className="text-lg font-serif italic mb-1">{project.title}</h3>
                  <div className="text-xs text-text-muted uppercase tracking-wider">
                    {project.type} — {project.year}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-20 border-t border-white/10 pt-12">
          <h2 className={`${THEME.typography.h2} mb-8`}>Technical Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div>
              <h3 className="text-lg font-serif italic mb-3 text-white">Features</h3>
              <ul className="space-y-2 text-text-muted">
                <li>• <strong>Deterministic:</strong> Same metadata → same thumbnail</li>
                <li>• <strong>Tiny size:</strong> Sub-1KB SVG data URLs</li>
                <li>• <strong>No external requests:</strong> Instant rendering</li>
                <li>• <strong>Themeable:</strong> Uses site color palette</li>
                <li>• <strong>Scalable:</strong> Vector graphics, perfect at any size</li>
                <li>• <strong>5 variants:</strong> Geometric, minimal, film-strip, grid, radial</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-serif italic mb-3 text-white">Usage</h3>
              <div className="bg-black/50 border border-white/10 rounded p-4 font-mono text-xs overflow-x-auto">
                <pre className="text-text-muted">
{`<ProceduralThumbnail
  title="Project Title"
  year="2024"
  type="Narrative"
  variant="geometric"
  className="w-full h-full"
/>`}
                </pre>
              </div>
              
              <div className="mt-6">
                <p className="text-text-muted">
                  Thumbnails automatically appear for projects without <code className="bg-white/10 px-1 rounded">videoUrl</code>.
                  No manual configuration needed—the system handles fallback seamlessly.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Color Palettes */}
        <div className="mt-16">
          <h3 className="text-lg font-serif italic mb-6 text-white">Color Palettes by Type</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {types.map((type) => (
              <div key={type} className="bg-white/5 border border-white/10 rounded-lg p-4">
                <div className="text-xs uppercase tracking-wider text-text-muted mb-3">{type}</div>
                <div className="aspect-video bg-black rounded overflow-hidden">
                  <ProceduralThumbnail
                    title={type}
                    year="2024"
                    type={type}
                    variant={selectedVariant}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
