# Procedural SVG Thumbnails

## Overview

The portfolio now features a sophisticated **procedural thumbnail generation system** that creates elegant, deterministic SVG thumbnails for projects without video links. These thumbnails replace generic placeholder images with unique, project-specific visuals that match the site's aesthetic.

---

## 🎯 Key Features

- **Deterministic Generation**: Same project metadata always produces the same thumbnail (stable across builds)
- **Tiny File Size**: Sub-1KB SVG data URLs (vs 200KB+ for images)
- **Zero External Requests**: Instant rendering, no network calls
- **Themeable**: Uses site color palette and typography from `theme.ts`
- **5 Visual Variants**: Geometric, Minimal, Film-strip, Grid, and Radial patterns
- **Animated Hero Support**: Subtle hue/gradient drift when used as hero art
- **Textless Mode**: Hide title/year/type for clean hero backgrounds
- **Type-Specific Palettes**: Different color schemes for Narrative, Commercial, Music Video, Documentary
- **Scalable**: Vector graphics, perfect at any resolution
- **Memoized**: React components use memoization for optimal performance

---

## 📁 File Structure

```
utils/
  └── thumbnailGenerator.ts         # Core generation logic (variants, colors, hashing)

components/
  ├── ProceduralThumbnail.tsx       # React component + hook
  └── views/
      ├── IndexView.tsx             # Grid/list integration
      ├── ProjectDetailView.tsx     # Hero background integration
      └── ThumbnailPreviewView.tsx  # Preview/storybook page

services/
  └── cmsService.ts                 # Removed hardcoded Unsplash fallback
```

---

## 🚀 Usage

### Automatic Fallback

Thumbnails automatically appear for projects **without a `videoUrl`**. No manual configuration needed.

```tsx
// In IndexView and ProjectDetailView - automatically renders
{!project.videoUrl ? (
  <ProceduralThumbnail
    title={project.title}
    year={project.year}
    type={project.type}
    className="w-full h-full object-cover"
  />
) : (
  <img src={project.heroImage} ... />
)}
```

### Manual Usage

```tsx
import { ProceduralThumbnail } from './components/ProceduralThumbnail';

<ProceduralThumbnail
  title="The Last Dance"
  year="2024"
  type="Narrative"
  variant="geometric"  // Optional: 'geometric' | 'minimal' | 'film-strip' | 'grid' | 'radial'
  width={1200}         // Optional: default 1200
  height={675}         // Optional: default 675 (16:9)
  className="w-full h-full object-cover"
  loading="lazy"
/>
```

### Hook for Data URLs

Useful for background images or SSR contexts:

```tsx
import { useProceduralThumbnail } from './components/ProceduralThumbnail';

const thumbnailUrl = useProceduralThumbnail(
  'Project Title',
  '2024',
  'Narrative',
  undefined,
  undefined,
  { showTitle: false, showMetadata: false } // ← textless hero background
);

// Use as background-image or src
<div style={{ backgroundImage: `url(${thumbnailUrl})` }} />
```

---

## 🎨 Visual Variants

### 1. **Geometric**
Abstract shapes, diagonal lines, circles, and rectangles with random positioning based on project hash.

### 2. **Minimal**
Clean typography-focused design with corner accents and subtle grid pattern.

### 3. **Film-strip**
Cinema-inspired with sprocket holes along edges and vertical film dividers.

### 4. **Grid**
Modular grid pattern with random cell fills, giving a digital/structured feel.

### 5. **Radial**
Concentric circles and radial lines emanating from center, creating depth.

**Selection Logic**: If no variant is specified, one is automatically chosen deterministically based on the project's metadata hash.

---

## 🎨 Color Palettes

Each project type has a unique color scheme:

| Type         | Primary   | Secondary | Accent   | Description                    |
|------------- |-----------|-----------|----------|--------------------------------|
| **Narrative**| `#1a1a2e` | `#16213e` | `#e94560`| Deep blues with red accent     |
| **Commercial**| `#0f3460`| `#16213e` | `#e94560`| Rich blues with red accent     |
| **Music Video**|`#2d132c`| `#3c1642` | `#ff6b9d`| Purple tones with pink accent  |
| **Documentary**|`#1e3a2e`| `#2c5f4e` | `#7cb342`| Forest greens with lime accent |
| **Uncategorized**|`#1a1a1a`|`#2a2a2a`|`#666666`| Neutral grays                  |

Colors are defined in `utils/thumbnailGenerator.ts` in the `TYPE_PALETTES` object.

---

## 🧪 Preview & Testing

Visit `/thumbnails` to access the **interactive preview page**:

```
http://localhost:3001/thumbnails
```

Features:
- Toggle between all 5 visual variants
- Custom thumbnail generator (input your own title/year/type)
- Gallery of sample projects showing each variant
- Technical documentation
- Color palette comparison

---

## 🔧 Customization

### Modify Color Palettes

Edit `utils/thumbnailGenerator.ts`:

```typescript
const TYPE_PALETTES: Record<string, { primary: string; secondary: string; accent: string }> = {
  Narrative: {
    primary: '#1a1a2e',    // Background gradient start
    secondary: '#16213e',  // Background gradient end
    accent: '#e94560'      // Shapes, lines, decorative elements
  },
  // ... add more types
};
```

### Add New Variants

Create a new generator function in `thumbnailGenerator.ts`:

```typescript
function generateMyNewVariant(
  config: ThumbnailConfig, 
  seed: number, 
  colors: ReturnType<typeof getColorPalette>
): string {
  const { width = 1200, height = 675 } = config;
  const shapes: string[] = [];
  
  // Your SVG generation logic here
  // Use seed for deterministic randomness: seededRandom(seed, index)
  
  return shapes.join('\n');
}
```

Then add it to the variant type and switch statement:

```typescript
export type ThumbnailVariant = 'geometric' | 'minimal' | 'film-strip' | 'grid' | 'radial' | 'my-new-variant';

// In generateProceduralThumbnail():
switch (selectedVariant) {
  case 'my-new-variant':
    pattern = generateMyNewVariant(config, seed, colors);
    break;
  // ... other cases
}
```

### Change Typography

Thumbnails use fonts from `THEME.fonts`:

```typescript
// In theme.ts
fonts: {
  sans: "Inter",             // Used for year/type labels
  serif: "Playfair Display", // Used for project titles
}
```

SVG generation references these in `thumbnailGenerator.ts`:

```typescript
font-family="${THEME.fonts.serif}, serif"
font-family="${THEME.fonts.sans}, sans-serif"
```

---

## 🎯 Integration Points

### 1. **IndexView (Filmography)**

- **Grid View**: Shows procedural thumbnail when `project.videoUrl` is missing
- **List View**: Shows mini thumbnail in mobile table view

### 2. **ProjectDetailView**

- **Hero Background**: Uses procedural thumbnail when no `videoUrl` and no `gallery` images exist
- **Animated Hero**: When procedural is used, a subtle color drift + gradient animation is applied
- **Textless**: Hero uses `showTitle=false` and `showMetadata=false` for clean artwork
- **Slideshow**: Integrated into slideshow slides array as first slide
- **CTA Button**: When no hero video is available, a styled CTA appears; clicking navigates to `/about` (tracked as `contact_cta_click`)

### 3. **CMS Service**

- Removed hardcoded Unsplash placeholder image
- Now returns empty string for `heroImage` when no images available
- Components handle the fallback with ProceduralThumbnail

---

## 🔬 Technical Details

### Deterministic Hashing

```typescript
// Simple string hash for seed generation
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

// Seed = hash(title + year + type)
const seedString = `${title}-${year}-${type}`;
const seed = hashString(seedString);
```

### Seeded Random Number Generator

```typescript
function seededRandom(seed: number, index: number = 0): number {
  const x = Math.sin(seed + index * 12.9898) * 43758.5453123;
  return x - Math.floor(x);
}
```

This ensures the same seed + index always produces the same "random" value.

### SVG Data URL Generation

```typescript
const svg = `<svg>...</svg>`;
const encoded = encodeURIComponent(svg)
  .replace(/'/g, '%27')
  .replace(/"/g, '%22');
  
return `data:image/svg+xml,${encoded}`;
```

Inline data URLs avoid external requests and work perfectly with React's `<img>` tag.

---

## 🚀 Performance

- **Memoized Component**: `React.memo()` prevents unnecessary re-renders
- **Memoized Hook**: `useMemo()` caches data URL generation
- **Sub-1KB Size**: Typical thumbnail is 600-900 bytes
- **Instant Rendering**: No network latency, no image decoding
- **Cache-Friendly**: Data URLs are deterministic (same input = same output)

---

## 📝 Future Enhancements

### Potential Additions

1. **Export PNG Rasters**: Generate static PNG files for third-party preview cards (OG images)
2. **Animation Variants**: Subtle SVG animations (e.g., pulsing gradients, rotating shapes)
3. **Custom Brand Logos**: Overlay client logos for commercial projects
4. **Texture Overlays**: Film grain, noise, halftone patterns
5. **Dynamic Color Themes**: Pull accent colors from project metadata or genre tags

### Implementation Example: PNG Export

```typescript
// In thumbnailGenerator.ts
export async function exportThumbnailAsPNG(
  config: ThumbnailConfig,
  width: number = 1200,
  height: number = 675
): Promise<Blob> {
  const dataUrl = generateProceduralThumbnail(config);
  
  // Create canvas and render SVG
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  
  const img = new Image();
  img.src = dataUrl;
  
  return new Promise((resolve) => {
    img.onload = () => {
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => resolve(blob!), 'image/png');
    };
  });
}
```

---

## 🐛 Troubleshooting

### Thumbnails Not Showing

1. Check that `project.videoUrl` is undefined or empty
2. Verify imports: `import { ProceduralThumbnail } from './components/ProceduralThumbnail'`
3. Ensure TypeScript compiled successfully: `npm run build`

### Variant Not Changing

Variants are **deterministic**. If you want a different variant for the same project:
- Explicitly pass `variant="film-strip"` prop
- Or change project metadata (title/year/type) to alter the hash

### Colors Don't Match Theme

### Hero CTA Placement (Mobile)
On mobile, the CTA is centered in the hero for clarity (`absolute inset-0 flex items-center justify-center`). On larger screens, it moves to the bottom-right (`md:bottom-24 md:right-12`). You can tweak these classes in `ProjectDetailView.tsx` to match any header/hero changes.

The color palettes in `thumbnailGenerator.ts` are separate from `theme.ts`. Update `TYPE_PALETTES` to match your site colors.

---

## 📚 API Reference

### `generateProceduralThumbnail(config: ThumbnailConfig): string`

**Returns**: SVG data URL

**Parameters**:
- `title` (string, required): Project title
- `year` (string, optional): Project year
- `type` (string, optional): Project type (affects color palette)
- `variant` (ThumbnailVariant, optional): Visual variant
- `width` (number, optional): Width in pixels (default: 1200)
- `height` (number, optional): Height in pixels (default: 675)
- `showTitle` (boolean, optional): Show large title text (default: true)
- `showMetadata` (boolean, optional): Show year/type labels (default: true)

### `<ProceduralThumbnail />` Component

React component with same props as `generateProceduralThumbnail` plus:
- `className` (string): CSS classes
- `alt` (string): Alt text (defaults to title)
- `loading` ('lazy' | 'eager'): Loading strategy
- `decoding` ('async' | 'sync' | 'auto'): Decode hint

### `useProceduralThumbnail()` Hook

Returns SVG data URL. Parameters are the same as `generateProceduralThumbnail`, with an optional options object `{ showTitle?: boolean; showMetadata?: boolean }`.

---

## 📄 License

This procedural thumbnail system is part of the Gabriel Athanasiou Portfolio project.

---

## 🙏 Credits

Developed by GitHub Copilot for Gabriel Athanasiou's portfolio website.

**Design Goals**: Elegant, performant, modular, and themeable SVG generation for projects without video assets.
