---
applyTo: "**/canvas/**"
---

# Feature: Canvas

A self contained component that renders a full width/height element that serves as a canvas.

- Allow user to paste images on to the canvas.
- Pasted image will be rendered at a standard size (non-resizable) of 200 \* 200 pixels
- User can drag to move
- Maintain an z order. Last interacted image should be on top

## Implementation

Use a `<div>` element to render the canvas. Do NOT use real `<canvas>` elements.
Each element is a real `<div>` element.
