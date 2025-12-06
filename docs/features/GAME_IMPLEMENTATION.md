# "Guess the Project" Game — Implementation Plan

## Overview

An interactive trivia game where users guess which project a random still image belongs to. The game is styled as a Pokémon-inspired trading card, featuring the project image on top with hidden details below that reveal upon answering. The feature integrates seamlessly with the portfolio's existing dark, minimal aesthetic.

---

## Game Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         PAGE LOAD                               │
│   • Filter projects with gallery.length > 0                     │
│   • Require minimum 3 eligible projects                         │
│   • Load high score from localStorage                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      SHUFFLE ANIMATION                          │
│   • Card flip/shuffle animation plays (~1.5s)                   │
│   • Builds anticipation before reveal                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                       PLAYING STATE                             │
│   • Random project selected                                     │
│   • Random image from project's gallery displayed               │
│   • Trading card shows image on top                             │
│   • Details section is blurred/hidden                           │
│   • 3 answer buttons below (1 correct, 2 random wrong)          │
│   • Correct answer position randomized each round               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    User clicks an answer
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                      REVEALED STATE                             │
│   • Card details animate in (unblur + fade)                     │
│   • Shows: Title, Genre, Year, About excerpt, "Learn More"      │
│   • Entire card is clickable → opens project in new tab         │
│   • If correct: Score +1, confetti animation, update high score if needed           │
│   • If wrong: No penalty, score stays the same                  │
│   • "Next" button appears                                       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    User clicks "Next"
                              ↓
                    ← Back to SHUFFLE ANIMATION
```

---

## UI Components

### 1. Trading Card Component

```
┌──────────────────────────────────────────┐
│  ╔════════════════════════════════════╗  │
│  ║                                    ║  │
│  ║         PROJECT IMAGE              ║  │
│  ║      (random from gallery)         ║  │
│  ║                                    ║  │
│  ╠════════════════════════════════════╣  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓  (blurred)           ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓  Genre • Year        ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓  About excerpt...    ║  │
│  ║  ▓▓▓▓▓▓▓▓▓▓▓▓  → Learn More        ║  │
│  ╚════════════════════════════════════╝  │
└──────────────────────────────────────────┘
          ↓ After answer ↓
┌──────────────────────────────────────────┐
│  ╔════════════════════════════════════╗  │
│  ║                                    ║  │
│  ║         PROJECT IMAGE              ║  │
│  ║                                    ║  │
│  ║                                    ║  │
│  ╠════════════════════════════════════╣  │
│  ║  Project Title                     ║  │
│  ║  Narrative • 2024                  ║  │
│  ║  "A story about dreams and..."     ║  │
│  ║  → Learn More                      ║  │
│  ╚════════════════════════════════════╝  │  ← Entire card clickable
└──────────────────────────────────────────┘
```

**Card Styling:**
- Minimal dark design matching site aesthetic
- Subtle gradient border (white/gray tones)
- Holographic shimmer effect on reveal
- Rounded corners, soft shadow
- Responsive sizing (smaller on mobile)

### 2. Answer Buttons

```
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   Project A    │  │   Project B    │  │   Project C    │
└────────────────┘  └────────────────┘  └────────────────┘
        ↓ After answer ↓
┌────────────────┐  ┌────────────────┐  ┌────────────────┐
│   ✓ Correct    │  │   ✗ Wrong      │  │   ✗ Wrong      │
│   (green glow) │  │   (red fade)   │  │   (red fade)   │
└────────────────┘  └────────────────┘  └────────────────┘
```

### 3. Score Display

```
┌─────────────────────────────────────┐
│   SCORE: 7    │    HIGH SCORE: 12   │
└─────────────────────────────────────┘
```

- Positioned at top of game area
- Score animates on update (scale pop effect)
- High score updates in real-time with celebration animation

### 4. Next Button

```
┌─────────────────────┐
│     Next Round →    │
└─────────────────────┘
```

- Only appears after answering
- Triggers shuffle animation → new round

---

## Scoring System

| Action         | Effect                                      |
|----------------|---------------------------------------------|
| Correct answer | Score +1                                    |
| Wrong answer   | No penalty (score stays the same)           |
| New high score | Update localStorage, show celebration       |
| Page reload    | Score resets to 0, high score persists      |

**localStorage keys:**
- `game_highScore` — Highest score achieved

---

## Project Selection Rules

1. **Eligibility**: Only projects with `gallery.length > 0` are included
2. **Minimum**: At least 3 eligible projects required to play
3. **Random selection**: Each round picks a random eligible project
4. **Image selection**: Random image from that project's `gallery[]` array
5. **Wrong answers**: 2 other random projects (different from correct answer and each other)
6. **Button order**: All 3 answers shuffled randomly each round

---

## Animations

### 1. Shuffle/Loading Animation (between rounds)
- Duration: ~1.2-1.5 seconds
- Effect: Card flip or shuffle motion
- Purpose: Build anticipation, provide loading feedback

### 2. Card Reveal Animation (on answer)
- Duration: ~700ms
- Effect: Details section unblurs + fades in
- Holographic shimmer plays across card

### 3. Score Update Animation
- Correct: Score number scales up briefly (pop effect)
- New high score: Celebration sparkle/glow effect

### 4. Button Feedback
- Correct: Green glow/pulse
- Wrong: Red tint + fade
- Disabled state after answering

---

## Page Layout

```
┌─────────────────────────────────────────────────────────────┐
│                      NAVIGATION BAR                         │
│   Featured  Filmography  Journal  About  [Game]             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                    SCORE: 0    HIGH: 5                      │
│                                                             │
│              ┌─────────────────────────┐                    │
│              │                         │                    │
│              │      TRADING CARD       │                    │
│              │                         │                    │
│              │      (image + info)     │                    │
│              │                         │                    │
│              └─────────────────────────┘                    │
│                                                             │
│       ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│       │ Answer1 │  │ Answer2 │  │ Answer3 │                 │
│       └─────────┘  └─────────┘  └─────────┘                 │
│                                                             │
│                     [ Next Round ]                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                  What the fuck is this?                     │
│                                                             │
│    Gabriel is a huge fan of video games and wanted to       │
│    incorporate that passion into his portfolio. This        │
│    trivia game tests your knowledge of his projects and     │
│    filmography in a fun, interactive way.                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         FOOTER                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create GameView.tsx
**File:** `components/views/GameView.tsx`

- Create new view component following existing patterns
- Accept `projects: Project[]` prop
- Implement game state machine: `idle` → `shuffling` → `playing` → `revealed`
- Filter eligible projects (gallery.length > 0)
- Handle edge case: < 3 eligible projects → show message
- Integrate page transitions matching other views

### Step 2: Create TradingCard.tsx
**File:** `components/TradingCard.tsx`

- Props: project data, revealed state, image URL
- Render project image using `OptimizedImage` with existing Cloudinary presets
- Details section with blur overlay (CSS backdrop-filter)
- Reveal animation on state change
- Click handler to open project page in new tab
- Responsive sizing

### Step 3: Add CSS Animations
**File:** `components/GlobalStyles.tsx`

Add keyframes for:
- `@keyframes cardShuffle` — Shuffle/flip animation
- `@keyframes cardReveal` — Unblur + fade in details
- `@keyframes scorePopCorrect` — Score increment animation
- `@keyframes holoShimmer` — Holographic effect on reveal

### Step 4: Update Navigation
**File:** `components/Navigation.tsx`

- Add "Game" NavLink after "About"
- Use existing NavLink styling

### Step 5: Update Routing
**File:** `App.tsx`

- Add lazy import for GameView
- Add `<Route path="/game" element={<GameView projects={data.projects} />} />`

### Step 6: Implement Score Persistence
**Inside GameView.tsx:**

```typescript
// Load high score on mount
const [highScore, setHighScore] = useState(() => {
  const saved = localStorage.getItem('game_highScore');
  return saved ? parseInt(saved, 10) : 0;
});

// Update high score when beaten
useEffect(() => {
  if (score > highScore) {
    setHighScore(score);
    localStorage.setItem('game_highScore', score.toString());
  }
}, [score, highScore]);
```

### Step 7: Game Logic Implementation

```typescript
// State
const [score, setScore] = useState(0);
const [gameState, setGameState] = useState<'shuffling' | 'playing' | 'revealed'>('shuffling');
const [currentProject, setCurrentProject] = useState<Project | null>(null);
const [currentImageUrl, setCurrentImageUrl] = useState('');
const [answers, setAnswers] = useState<Project[]>([]); // 3 projects, shuffled
const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);

// Start new round
const startNewRound = () => {
  setGameState('shuffling');
  setSelectedAnswer(null);
  
  setTimeout(() => {
    const eligible = projects.filter(p => p.gallery?.length > 0);
    const correct = pickRandom(eligible);
    const wrongOptions = pickRandomN(eligible.filter(p => p.id !== correct.id), 2);
    const shuffledAnswers = shuffle([correct, ...wrongOptions]);
    
    setCurrentProject(correct);
    setCurrentImageUrl(pickRandom(correct.gallery));
    setAnswers(shuffledAnswers);
    setGameState('playing');
  }, 1500); // Shuffle animation duration
};

// Handle answer selection
const handleAnswer = (projectId: string) => {
  setSelectedAnswer(projectId);
  setGameState('revealed');
  
  if (projectId === currentProject?.id) {
    setScore(s => s + 1);
  }
};
```

---

## File Structure After Implementation

```
components/
├── views/
│   ├── GameView.tsx          ← NEW: Main game page
│   └── ... (existing views)
├── TradingCard.tsx           ← NEW: Pokémon-style card component
├── GlobalStyles.tsx          ← MODIFIED: Add game animations
├── Navigation.tsx            ← MODIFIED: Add "Game" link
└── ... (existing components)

App.tsx                       ← MODIFIED: Add /game route
```

---

## Technical Notes

### Image Loading
- Use `OptimizedImage` component with `preset="fine"` for card images
- Lazy loading for performance
- Fallback to `heroImage` if gallery image fails

### Responsive Design
- Card scales down on mobile (max-width constraints)
- Answer buttons stack vertically on small screens
- Touch-friendly button sizes (min 44px tap targets)

### Accessibility
- Keyboard navigation for buttons
- Focus states on interactive elements
- Screen reader announcements for score changes
- Proper alt text on images

### Edge Cases
- < 3 eligible projects: Show friendly message, no game
- Image load failure: Show placeholder with retry
- localStorage unavailable: Fall back to session-only scoring

---

## Design Principles

1. **Minimal**: Dark background, subtle borders, no clutter
2. **Consistent**: Match existing typography (serif italic headings, meta text)
3. **Playful**: Card aesthetic adds personality without being garish
4. **Responsive**: Works beautifully on all screen sizes
5. **Performant**: Smooth animations, optimized images
