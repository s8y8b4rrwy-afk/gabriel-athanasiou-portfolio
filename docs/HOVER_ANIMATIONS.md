# Hover Animations Documentation

## Overview

All thumbnail hover animations across the portfolio use a consistent, optimized approach for smooth, jitter-free transitions.

---

## ✅ Correct Implementation

### Standard Thumbnail Hover

```tsx
<OptimizedImage
  recordId={item.id}
  fallbackUrl={item.heroImage}
  type="project"
  alt={item.title}
  loading="lazy"
  className="w-full h-full object-cover transform-gpu scale-100 opacity-80 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
/>
```

### Key Classes

| Class | Purpose |
|-------|---------|
| `transform-gpu` | Forces hardware acceleration for smooth rendering |
| `scale-100` | Initial scale (no zoom) |
| `group-hover:scale-[1.02]` | Subtle zoom on hover (2% scale increase) |
| `opacity-80` or `opacity-90` | Slightly dimmed initial state |
| `group-hover:opacity-100` | Full brightness on hover |
| `transition-all` | Transitions all properties together (prevents jitter) |
| `duration-700` | 700ms duration (optimal for hover effects) |
| `ease-out` | Natural deceleration curve |

---

## ❌ What NOT To Do

### 1. **Don't Use Long Durations**
```tsx
// ❌ BAD - Causes sluggish, jumpy animations
className="transition duration-[2000ms]"

// ✅ GOOD
className="transition-all duration-700"
```

### 2. **Don't Use `will-change-transform`**
```tsx
// ❌ BAD - Causes unnecessary GPU layer promotions and jitter
className="transform scale-100 group-hover:scale-[1.02] will-change-transform"

// ✅ GOOD - transform-gpu provides proper hardware acceleration
className="transform-gpu scale-100 group-hover:scale-[1.02]"
```

### 3. **Don't Separate Transitions**
```tsx
// ❌ BAD - opacity and transform transition independently
className="transform scale-100 transition-transform duration-700 opacity-80 transition-opacity"

// ✅ GOOD - everything transitions together
className="transform-gpu scale-100 opacity-80 group-hover:scale-[1.02] group-hover:opacity-100 transition-all duration-700"
```

### 4. **Don't Use Template Literals in OptimizedImage**
```tsx
// ❌ BAD - Breaks Tailwind class detection in some cases
className={`w-full h-full transition ${someVar}`}

// ✅ GOOD - Static classes
className="w-full h-full object-cover transform-gpu transition-all duration-700"
```

---

## 🎨 Variants by Context

### Hero Images (Slower, More Cinematic)
```tsx
className="w-full h-full object-cover transform-gpu scale-100 group-hover:scale-[1.02] transition-transform duration-[1200ms] ease-out"
```
- Longer duration (1200ms) for more dramatic effect
- Only transforms, no opacity change

### Featured Grids (Standard)
```tsx
className="w-full h-full object-cover transform-gpu scale-100 opacity-80 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-700 ease-out"
```
- 700ms duration
- Both scale and opacity change

### Journal Thumbnails with Grayscale
```tsx
className="w-full h-full object-cover transform-gpu grayscale group-hover:grayscale-0 group-hover:scale-[1.02] transition-all duration-700 ease-out"
```
- Adds color on hover
- Combined with scale

---

## 🔧 Technical Details

### CSS Class Order in OptimizedImage Component

The `OptimizedImage` component applies classes in this order:

```tsx
className={`${isLoaded ? 'opacity-100' : 'opacity-0'} ${className}`}
style={{ transition: isLoaded ? undefined : 'opacity 0.5s ease-out' }}
```

**Critical:** 
- Loading state classes come first
- Parent `className` prop comes **last** (takes precedence)
- Fade-in transition only applied during loading via inline style
- After loading, parent transitions control all behavior

This ensures:
1. Initial fade-in works (0 → 100% opacity on load)
2. Hover animations from parent take full control after load
3. No conflicting transitions

### Hardware Acceleration

`transform-gpu` translates to:
```css
transform: translateZ(0);
```

This creates a new GPU layer, ensuring:
- Smooth 60fps animations
- No main-thread blocking
- Consistent performance across devices

---

## 📋 Implementation Checklist

When adding new thumbnails:

- [ ] Parent container has `group` class
- [ ] Image has `transform-gpu`
- [ ] Image has base scale (`scale-100`)
- [ ] Image has hover scale (`group-hover:scale-[1.02]`)
- [ ] Image has base opacity (`opacity-80` or `opacity-90`)
- [ ] Image has hover opacity (`group-hover:opacity-100`)
- [ ] Uses `transition-all`
- [ ] Duration is `duration-700` (or `duration-[1200ms]` for heroes)
- [ ] Easing is `ease-out`
- [ ] No `will-change-transform`
- [ ] No durations over 1500ms

---

## 🐛 Troubleshooting

### Animations Still Jumpy?

1. Check for conflicting transitions in parent/child elements
2. Verify no `will-change-transform` anywhere in the chain
3. Ensure GPU acceleration is enabled (`transform-gpu`)
4. Check duration isn't too long (>1500ms)

### Scale Not Working?

1. Verify parent has `overflow-hidden` to prevent content overflow
2. Check `group` class is on parent container
3. Ensure `group-hover:` prefix is correct

### Opacity Not Changing?

1. Check if there are other opacity classes overriding
2. Verify base opacity is less than 100 (`opacity-80`, `opacity-90`)
3. Ensure no conflicting CSS in GlobalStyles

---

## 📝 Files Modified

- `components/common/OptimizedImage.tsx` - Reordered class application
- `components/views/HomeView.tsx` - Updated hover classes
- `components/views/BlogView.tsx` - Updated hover classes
- `components/views/IndexView.tsx` - Updated hover classes

**Last Updated:** November 26, 2025
