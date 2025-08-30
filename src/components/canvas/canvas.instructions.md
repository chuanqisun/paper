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
