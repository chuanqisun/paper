---
applyTo: "**"
---

- Minimum CSS to establish layout and functionality
- Avoid decorative styles
- Light theme
- Monospace aesthetics, main font size 14px. Heading can be bold but not larger
- Monochrome color palette. Heading and paragraph text is off black. Secondary texts can be lighter. Use pure black only for active states whwere contrast is needed
- Prefer spacing over borders
- Use ch units for spacing
- Use system default styles as much as possible, override when necessary
- We have 0 margin/padding reset.
- Margin/gap should be set by the parent, Padding should be avoided, except for elements with borders
- Write modular reusable classes, separate layout from component styles

## Layout

- Single column minimal layout. Clamp max-width to 90rem
- Top to bottom layout the sections.
- Each section has a header and content area

## Form elements

- Use browser default styles as much as possible
- textarea should be at least 2 rows high. No resize. But set "fieldsize: content" to let browser auto resize it for us
