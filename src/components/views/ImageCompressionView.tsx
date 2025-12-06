/**
 * ImageCompressionView
 * 
 * Internal tool for comparing image compression settings side-by-side.
 * Displays multiple compression variants with file size and quality metrics.
 */

import React, { useState, useEffect, useRef } from 'react';
import { ImageComparisonSlider } from '../ImageComparisonSlider';
import presetConfig from '../../config/compressionPresets.json';

interface CompressionVariant {
  presetId: string;
  presetName: string;
  format: string;
  quality: number;
  lossless: boolean;
  filename: string;
  fileSize: number;
  fileSizeKB: string;
  width: number;
  height: number;
  reductionPercent: number;
  url: string;
}

interface ImageMetrics {
  original: string;
  originalId: string;
  originalFilename: string;
  originalSize: number;
  originalSizeKB: string;
  variants: CompressionVariant[];
}

export const ImageCompressionView: React.FC = () => {
  const [metrics, setMetrics] = useState<ImageMetrics[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<{
    before: string;
    after: string;
    beforeLabel: string;
    afterLabel: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<{
    original: string;
    originalSize: number;
    variants: CompressionVariant[];
  } | null>(null);
  const [processingUpload, setProcessingUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      const response = await fetch('/images/compression-samples/metrics.json');
      if (!response.ok) {
        throw new Error('Failed to load compression metrics. Run: npm run generate:compression');
      }
      const data = await response.json();
      setMetrics(data);
      if (data.length > 0) {
        setSelectedImage(data[0].originalId);
      }
      setLoading(false);
    } catch (err) {
      console.error('Error loading metrics:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  };

  const handleCompare = (variantUrl: string, variantLabel: string) => {
    const isUploadedView = selectedImage === 'uploaded';
    
    if (isUploadedView && uploadedImage) {
      setComparisonMode({
        before: uploadedImage.original,
        after: variantUrl,
        beforeLabel: 'Original Upload',
        afterLabel: variantLabel
      });
      return;
    }

    const currentMetrics = metrics.find(m => m.originalId === selectedImage);
    if (!currentMetrics) return;

    // Compare against the original JPEG
    const originalUrl = `/images/compression-samples/${currentMetrics.originalFilename}`;
    
    setComparisonMode({
      before: originalUrl,
      after: variantUrl,
      beforeLabel: 'Original JPEG',
      afterLabel: variantLabel
    });
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if it's an image
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file');
      return;
    }

    setProcessingUpload(true);

    try {
      // Read the file as data URL for display
      const reader = new FileReader();
      reader.onload = async (e) => {
        const originalDataUrl = e.target?.result as string;
        const originalSize = file.size;

        // Create an img element to get dimensions
        const img = new Image();
        img.onload = async () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;

          // Resize to max 1200px width
          const maxWidth = 1200;
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = img.width * scale;
          canvas.height = img.height * scale;

          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          // Generate variants using canvas compression with Promises
          const variants: CompressionVariant[] = [];
          const compressionPromises: Promise<void>[] = [];

          for (const preset of presetConfig.presets) {
            if (preset.format === 'jpeg' || preset.format === 'webp') {
              const mimeType = preset.format === 'jpeg' ? 'image/jpeg' : 'image/webp';
              const quality = preset.lossless ? 1.0 : preset.quality / 100;

              const promise = new Promise<void>((resolve) => {
                canvas.toBlob(
                  (blob) => {
                    if (blob) {
                      const url = URL.createObjectURL(blob);
                      const reduction = ((originalSize - blob.size) / originalSize * 100).toFixed(1);

                      variants.push({
                        presetId: preset.id,
                        presetName: preset.name,
                        format: preset.format,
                        quality: preset.quality,
                        lossless: preset.lossless || false,
                        filename: `uploaded_${preset.id}.${preset.format}`,
                        fileSize: blob.size,
                        fileSizeKB: (blob.size / 1024).toFixed(2),
                        width: canvas.width,
                        height: canvas.height,
                        reductionPercent: parseFloat(reduction),
                        url: url
                      });
                    }
                    resolve();
                  },
                  mimeType,
                  quality
                );
              });
              compressionPromises.push(promise);
            }
          }

          // Wait for all compressions to complete
          await Promise.all(compressionPromises);

          // Sort variants in logical order
          const order = ['original', 'webp-lossless', 'webp-high', 'webp-90', 'webp-88', 'webp-current', 'webp-medium', 'webp-low'];
          variants.sort((a, b) => {
            const aIndex = order.indexOf(a.presetId);
            const bIndex = order.indexOf(b.presetId);
            return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
          });

          setUploadedImage({
            original: originalDataUrl,
            originalSize: originalSize,
            variants: variants
          });
          setSelectedImage('uploaded');
          setProcessingUpload(false);
        };
        img.src = originalDataUrl;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Error processing upload:', err);
      alert('Failed to process image');
      setProcessingUpload(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-24 px-4 flex items-center justify-center">
        <div className="text-white/40 text-sm animate-pulse">Loading compression samples...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-24 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-light mb-6">Image Compression Comparison</h1>
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <h2 className="text-red-400 font-medium mb-2">Error Loading Samples</h2>
            <p className="text-white/60 mb-4">{error}</p>
            <div className="bg-black/40 rounded p-4 text-sm font-mono text-white/80">
              npm run generate:compression
            </div>
            <p className="text-white/40 text-sm mt-4">
              This will generate compression variants for comparison.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentMetrics = selectedImage === 'uploaded' 
    ? uploadedImage 
      ? {
          original: 'Your Upload',
          originalId: 'uploaded',
          originalFilename: 'uploaded.jpg',
          originalSize: uploadedImage.originalSize,
          originalSizeKB: (uploadedImage.originalSize / 1024).toFixed(2),
          variants: uploadedImage.variants
        }
      : null
    : metrics.find(m => m.originalId === selectedImage);

  return (
    <div className="min-h-screen pt-24 px-4 pb-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-light mb-2">Image Compression Comparison</h1>
          <p className="text-white/40 text-sm">
            Compare different compression settings to find the optimal balance between quality and file size.
          </p>
        </div>

        {/* Upload Section */}
        <div className="mb-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-medium text-blue-300 mb-1">Upload Your Own Image</h2>
              <p className="text-white/60 text-sm">Test compression on any image instantly</p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={processingUpload}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 text-white px-6 py-2 rounded-lg transition-colors font-medium"
            >
              {processingUpload ? 'Processing...' : 'Choose Image'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
          {processingUpload && (
            <div className="text-sm text-white/60">
              <div className="animate-pulse">Compressing image with multiple settings...</div>
            </div>
          )}
          {uploadedImage && (
            <div className="mt-3 text-sm text-green-400">
              ✓ Image uploaded and processed with {uploadedImage.variants.length} compression variants
            </div>
          )}
        </div>

        {/* Image selector */}
        <div className="mb-8">
          <label className="block text-sm text-white/60 mb-2">Sample Image</label>
          <select
            value={selectedImage || ''}
            onChange={(e) => setSelectedImage(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-white/30 transition-colors"
          >
            {uploadedImage && (
              <option value="uploaded">Your Uploaded Image</option>
            )}
            {metrics.map(m => (
              <option key={m.originalId} value={m.originalId}>
                {m.original}
              </option>
            ))}
          </select>
        </div>

        {currentMetrics && (
          <>
            {/* Original Image Preview */}
            <div className="mb-8 bg-white/5 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-medium mb-4">Original Image</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="aspect-video bg-black rounded overflow-hidden">
                  <img 
                    src={selectedImage === 'uploaded' ? uploadedImage?.original : `/images/compression-samples/${currentMetrics.originalFilename}`}
                    alt={currentMetrics.original}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col justify-center space-y-3">
                  <div>
                    <div className="text-sm text-white/60">Title</div>
                    <div className="font-medium">{currentMetrics.original}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/60">Format</div>
                    <div className="font-medium">JPEG (Uncompressed)</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/60">File Size</div>
                    <div className="font-medium font-mono">{currentMetrics.originalSizeKB} KB</div>
                  </div>
                  <div className="text-sm text-white/40 mt-2">
                    All variants below are compared against this original image
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {currentMetrics.variants.map((variant) => {
                const isBaseline = variant.presetId === 'webp-current';
                const originalSize = currentMetrics.originalSize;
                const savingsVsOriginal = (((originalSize - variant.fileSize) / originalSize) * 100).toFixed(1);
                
                return (
                  <div 
                    key={variant.presetId}
                    className={`bg-white/5 rounded-lg overflow-hidden border transition-all hover:border-white/30 ${
                      isBaseline ? 'border-yellow-500/50' : 'border-white/10'
                    }`}
                  >
                    {/* Image preview */}
                    <div 
                      className="relative aspect-video bg-black cursor-pointer group"
                      onClick={() => handleCompare(variant.url, variant.presetName)}
                    >
                      <img 
                        src={variant.url} 
                        alt={variant.presetName}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-white text-sm font-medium">Click to Compare</div>
                      </div>
                      {isBaseline && (
                        <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">
                          CURRENT
                        </div>
                      )}
                    </div>

                    {/* Metadata */}
                    <div className="p-4">
                      <h3 className="font-medium text-white mb-1">{variant.presetName}</h3>
                      <div className="text-sm text-white/60 space-y-1">
                        <div className="flex justify-between">
                          <span>Format:</span>
                          <span className="text-white/80 uppercase">{variant.format}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Quality:</span>
                          <span className="text-white/80">
                            {variant.lossless ? 'Lossless' : `Q${variant.quality}`}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>File Size:</span>
                          <span className="text-white/80 font-mono">{variant.fileSizeKB} KB</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Dimensions:</span>
                          <span className="text-white/80 font-mono">{variant.width}×{variant.height}</span>
                        </div>
                        
                        {/* Comparison metrics */}
                        <div className="pt-2 mt-2 border-t border-white/10">
                          <div className="flex justify-between items-center">
                            <span>vs Original:</span>
                            <span className={`font-mono font-medium ${
                              parseFloat(savingsVsOriginal) > 0 
                                ? 'text-green-400' 
                                : parseFloat(savingsVsOriginal) < 0 
                                ? 'text-red-400' 
                                : 'text-white/80'
                            }`}>
                              {parseFloat(savingsVsOriginal) > 0 ? '-' : '+'}
                              {Math.abs(parseFloat(savingsVsOriginal))}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-12 bg-white/5 rounded-lg p-6 border border-white/10">
              <h2 className="text-xl font-medium mb-4">Quick Summary</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <div className="text-sm text-white/60 mb-1">Smallest File</div>
                  <div className="font-medium">
                    {currentMetrics.variants.reduce((min, v) => 
                      v.fileSize < min.fileSize ? v : min
                    ).presetName}
                  </div>
                  <div className="text-sm text-white/60 mt-1">
                    {currentMetrics.variants.reduce((min, v) => 
                      v.fileSize < min.fileSize ? v : min
                    ).fileSizeKB} KB
                  </div>
                </div>
                <div>
                  <div className="text-sm text-white/60 mb-1">Largest File</div>
                  <div className="font-medium">
                    {currentMetrics.variants.reduce((max, v) => 
                      v.fileSize > max.fileSize ? v : max
                    ).presetName}
                  </div>
                  <div className="text-sm text-white/60 mt-1">
                    {currentMetrics.variants.reduce((max, v) => 
                      v.fileSize > max.fileSize ? v : max
                    ).fileSizeKB} KB
                  </div>
                </div>
                <div>
                  <div className="text-sm text-white/60 mb-1">Total Variants</div>
                  <div className="font-medium">{currentMetrics.variants.length}</div>
                  <div className="text-sm text-white/60 mt-1">
                    {new Set(currentMetrics.variants.map(v => v.format)).size} formats
                  </div>
                </div>
              </div>
            </div>

            {/* Configuration Info */}
            <div className="mt-8 bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
              <h2 className="text-lg font-medium mb-2 text-blue-300">How to Update Settings</h2>
              <p className="text-white/60 text-sm mb-3">
                To modify compression presets, edit the configuration file:
              </p>
              <div className="bg-black/40 rounded p-3 text-sm font-mono text-white/80 mb-3">
                config/compressionPresets.json
              </div>
              <p className="text-white/60 text-sm">
                After making changes, regenerate samples with: <code className="text-white/80 bg-black/40 px-2 py-0.5 rounded">npm run generate:compression</code>
              </p>
            </div>
          </>
        )}
      </div>

      {/* Comparison Modal */}
      {comparisonMode && (
        <ImageComparisonSlider
          beforeImage={comparisonMode.before}
          afterImage={comparisonMode.after}
          beforeLabel={comparisonMode.beforeLabel}
          afterLabel={comparisonMode.afterLabel}
          onClose={() => setComparisonMode(null)}
        />
      )}
    </div>
  );
};
