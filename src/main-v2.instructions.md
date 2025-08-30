---
applyTo: "**/main-v2.ts"
---

# Layout

## Composition

- Top of the screen is a header bar
  - Contains a button to setup API connections
- Rest of the screen is main area of the screen is the canvas
  - Full screen canvas for user to manipulate objects. Similar to Miro and Figma
  - See details in [canvas documentation](./components//canvas/canvas.instructions.md)
- Floating at the bottom of the screen is a context menu tray, activated based on the state of the app
  - Default: suggest new ideas to add to canvas
  - When one item is selected: display caption and labels, and suggest more like this
  - When multiple items are selected: display shared pattern, and suggest more like the group

## Z-Index

Top and Main areas are on the same level. Try is floating on top

## Scroll

Only the main area should have horizontal and vertical scrolling.
