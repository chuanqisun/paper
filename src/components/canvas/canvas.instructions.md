---
applyTo: "**/canvas/**"
---

# Feature: Canvas

A self contained component that renders a full width/height element that serves as a canvas.

- Allow user to paste images on to the canvas.
- Pasted image will be rendered at a standard size (non-resizable) of 200 \* 200 pixels
- User can drag to move
- Maintain an z order. Last interacted image should be on top

## Content

Use a `<div>` element to render the canvas. Do NOT use real `<canvas>` elements.
Each element is a real `<div>` element.

## Behavior

### Selection

- User may select 0, 1, or multiple items on the board
- Mouse click expresses intent to single select
- Click on canvas to deselect all
- Ctrl/Cmd + click to toggle selection during multi-select. Shift + click behaves the same.
- Selected item should have a prominent outline

### Pasting

- Pasted item should appear near the center of the viewport despite current scroll position of the canvas

### Mouse interaction

- Drag on canvas (not implemented)
- Drag on selection: move the selected item(s)
  - Attention to details: the gesture conflicts with click to select item. Make sure click to is implemented on mouse up so we can differentiate move/selection
- Click on canvas/items, see details in ### Selection
- Hold Space + drag: panning the canvas (not implemented)

### Keyboard interaction

- Delete key: remove selected items

## Style

Dot matrix grid background, efficiently rendered with repeating background image.

## AI event handling

The canvas can trigger the following events

- Image pasted/removed
- Label updated

AI can emit the following actions:

- Update image caption
- Update image labels
- Suggest new image

## Workflow

When user pastes a new image, use AI to caption the image based the subject, scene, and style of the image.
AI can label the image based on the context of the entire canvas
User can manually edit the caption and labels of any image
AI can suggest new image (text caption only) based on the existing images
AI can discuss with the user to provide more design inspirations
AI can generate a final design inspiration report summarizing the discoveries made on the board
