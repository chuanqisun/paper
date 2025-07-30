---
applyTo: "**/generative-image.ts"
---

## Goal

A web component that displays AI generated image based on a user prompt.

## Progressive enhancement

It should render a placeholder while loading, using placehold.co.
Placehold.co example: https://placehold.co/600x400

## Reactivity

It should regenerate when prompt or image dimension changes.

- `prompt`, `width`, and `height` attributes should lead to generation.
  - Width and Height are NOT on screen dimensions, but the dimensions of the generated image.
- `placeholderSrc` attribute can be used to specify a custom placeholder image.

## Attribute reflection

A "status" attribute should reflect the current state of the component

- "empty" when prompt is blank
- "loading" when the image is being generated
- "error" when there was an error generating the image
- "success" when the image was successfully generated

## Web component

- Do NOT use shadow DOM. We want user to have direct DOM access
- You can use lit-html for templating. Styles are separately imported to the global scope via CSS file.
- User can use CSS to style inner `img` tag

## Responsive design

It's possible the screen size doesn't match the image dimensions. User should style the `img` tag to make adjustments
