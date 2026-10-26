# UI & Design Rules

- **No AI-Fluff or Marketing Copy:** Never generate promotional, cheesy, or AI-sounding copy (e.g., "AI powered", "Live", "Track velocity and pipeline...", "Needs immediate attention"). Use concise, direct, professional labels like Linear (e.g. "Created", "Resolved", "In progress", "Backlog").
- **No Colorful or Glowing Icons:** Use neutral, monochrome, muted icons (`text-muted-foreground`). Never use bright or multi-colored icon backgrounds (e.g., fuchsia, bright green, or glowing badges).
- **No Voice vs Manual Tracking Metrics:** Do not create metrics or charts measuring voice vs manual issue creation. Focus purely on issue management metrics: throughput, resolution rate, status breakdown, priority distribution, and team assignees.
- **No Redundant Action Buttons in Views:** Do not inject "New issue" or creation buttons inside analytical or dashboard view content; views are for reporting and visualization.
- **Unified Border Token:** Always use the dedicated `border-subtle` class for borders throughout the app. Never use inconsistent arbitrary opacities like `border-white/10`, `border-white/[0.08]`, `border-white/[0.06]`, or `border-white/[0.04]`.
- **Clean Linear Aesthetic:** Minimalist dark mode, high data density, neutral borders, neutral backgrounds (`bg-white/[0.02]`), and subtle chart strokes.
