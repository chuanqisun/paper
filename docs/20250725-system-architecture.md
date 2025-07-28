# System Architecture

A pipeline for mood board based prodcut designs generation.

## Workflow

A Human-AI co-iterative loop. Non-linear progression. End with product requirements documentation (PRD)

| Step                  | Human                         | AI                                                       |
| --------------------- | ----------------------------- | -------------------------------------------------------- |
| Parti                 | Write down one "big idea"     | Suggest alternatives                                     |
| Conceptual Map        | Explore related concepts      | Suggest and define concepts                              |
| Parameterization      | Specify domain parameters     | Suggest additional aspects, and suggest attribute values |
| Artifact Synthesis    | Steer AI with preference      | Generate artifacts while adhering to latest preference   |
| Product Specification | Provide requirements, outline | Generate (PRD) based on all of the assets above          |

## Packaging design as an example

The following content is co-creacted by human and AI.

- **Parti**: Mildness
- **Conceptual Map**

  - Gentle: Soft, non-aggressive, caring approach that doesn't overwhelm or irritate
  - Organic: Natural, chemical-free, derived from earth's pure resources
  - Healthy: Promotes wellness, nourishing, beneficial for long-term use
  - Nuanced: Subtle, sophisticated, understated elegance
  - Minimal: Clean, uncluttered, essential elements only
  - Breathable: Light, airy, allowing natural processes
  - Harmonious: Balanced, peaceful coexistence of elements
  - Pure: Unadulterated, transparent, honest

- **Parameterization**

  - Domain: Personal Hygiene product packaging design
  - Color: Sage green, Warm beige, Soft lavender, Cream white, Dusty rose
  - Shape: Rounded corners, Organic curves, Smooth edges, Teardrop forms
  - Texture: Matte finish, Soft-touch coating, Linen embossing, Subtle grain
  - Typography: Sans-serif, Light weight, Generous spacing, Lowercase preference
  - Material: Recycled paper, Bamboo fiber, Glass, Biodegradable plastics
  - Smell: Unscented, Light botanical, Fresh linen, Subtle chamomile

- **Artifact Synthesis**

  - **Natural Elements**: Dewy morning leaves, River stones, Cotton bolls, Bamboo stalks, White sand, Eucalyptus branches, Milk drops, Cloud formations
  - **Textures**: Raw linen fabric, Handmade paper, Frosted glass, Smooth pebbles, Baby skin, Silk cocoon, Fresh soap bar, Ceramic glaze
  - **Color Moments**: Dawn sky gradient, Matcha latte swirl, Sea foam, Oat milk pour, Sage garden mist, Pearl essence, Wheat field horizon
  - **Lifestyle Imagery**: Morning skincare ritual, Folded white towels, Minimalist bathroom shelf, Hand touching water surface, Steam rising from tea, Gentle hand gestures, Clean cotton sheets
  - **Abstract Forms**: Soft circles overlapping, Water ripples, Organic blob shapes, Gentle gradients, Negative space compositions, Flowing lines, Translucent layers
  - **Material Samples**: Unbleached cotton, Rice paper, Frosted acrylic, Natural cork, Pressed flowers, Sea glass, Pumice stone, Bamboo veneer

- **Product Specification**

```md PRD.md
# Product Requirements Document: Mild Personal Hygiene Packaging

## Executive Summary

Design packaging for a personal hygiene product line that embodies mildness through visual, tactile, and sustainable design choices. The packaging should communicate gentleness, purity, and care while maintaining premium appeal.

## Product Vision

Create packaging that feels like a gentle embrace - reassuring users that the product inside is as mild and caring as the package that holds it.

## Core Requirements

### Visual Design

- **Primary Colors**: Sage green (#87A96B) as hero color, complemented by warm beige (#F5E6D3)
- **Secondary Palette**: Soft lavender, cream white, dusty rose for product differentiation
- **Typography**: Clean sans-serif (suggested: Helvetica Neue Light), minimum 12pt for body text
- **Imagery**: Abstract organic shapes, no harsh geometric elements
- **White Space**: Minimum 40% negative space on primary display panel

### Physical Specifications

- **Materials**:
  - Primary: 80% post-consumer recycled paperboard with matte coating
  - Alternative: Sugarcane bagasse for eco-conscious lines
- **Shape**: Rounded corners (minimum 5mm radius), ergonomic grip considerations
- **Texture**: Soft-touch matte lamination or uncoated natural texture
- **Size Variants**: Travel (50ml), Regular (200ml), Family (500ml)

### Sustainability Requirements

- 100% recyclable or compostable materials
- Soy-based inks only
- Minimal packaging layers (maximum 2)
- FSC certified paper sources
- Carbon-neutral shipping materials

### User Experience

- **Opening**: Easy-tear strip or simple flip-top, accessible for all ages
- **Information Hierarchy**:
  1. Product name (mild emphasis)
  2. Key benefit
  3. Usage instructions
  4. Ingredients (full transparency)
- **Tactile Experience**: Smooth, soft edges that feel pleasant to hold
- **Refill System**: Design must accommodate refill pouches

### Brand Communication

- **Messaging Tone**: Whisper, don't shout - all copy in sentence case
- **Key Words**: Gentle, Pure, Caring, Natural, Mindful
- **Avoid**: Clinical terminology, aggressive claims, excessive certifications logos

### Technical Specifications

- **Print Method**: Offset printing with matte varnish
- **Dieline**: Accommodate 3mm bleed, 5mm safety margin
- **Barcodes**: GS1-128 standard, positioned on bottom panel
- **Regulatory**: Include all required FDA/regulatory information in 6pt minimum

## Success Metrics

- 90% consumer recognition of "mildness" attribute in testing
- 25% reduction in packaging material vs. current industry standard
- 95% successful first-time opening rate
- 80% consumers report positive tactile experience

## Timeline

- Concept Development: 4 weeks
- Prototyping: 3 weeks
- User Testing: 2 weeks
- Final Production: 6 weeks

## Constraints

- Budget: $0.45-0.65 per unit packaging cost
- Shelf stability: 24 months minimum
- Retail compliance: Standard shelf dimensions
- International shipping: Flat-pack capability required
```

## Appendix

Prompts

```txt
SYSTEM PROMPT
you are an AI helping human design a product with a multi step process. Human has already provided content. You must help the human finish the full workflow by responding with the full content for the packaging design example.

Think of Artifact synthesis as a mood board. You must come up with a list of objects/things/imagaries from a diverse perspectives to populate the board.

Workflow
| Step                  | Human                         | AI                                                       |
| --------------------- | ----------------------------- | -------------------------------------------------------- |
| Parti                 | Write down one "big idea"     | Suggest alternatives                                     |
| Conceptual Map        | Explore related concepts      | Suggest and define concepts                              |
| Parameterization      | Specify domain parameters     | Suggest additional aspects, and suggest attribute values |
| Artifact Synthesis    | Steer AI with preference      | Generate artifacts while adhering to latest preference   |
| Product Specification | Provide requirements, outline | Generate (PRD) based on all of the assets above          |
```

```txt
USER PROMPT

- **Parti**: Mildness
- **Conceptual Map**
  - Gentle: (definition...)
  - Organic
  - Healthy
  - Nuanced
  - ...
- **Parameterization**
  - Domain: Personal Hygiene product packaging design
  - Color: Green, Earth tone, Pastel...
  - Shape: ...
  - Smell: ...
- **Artifact Synthesis**
  - ...
- **Product Specficiation**
```
