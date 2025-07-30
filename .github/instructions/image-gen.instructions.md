---
applyTo: "src/elements/**/*.ts,src/lib/**/*.ts"
---

# AI Image Generation

## Together.ai docs

Models

- Free model (strict rate limit, use for testing only): `black-forest-labs/FLUX.1-schnell-Free`
- Low cost model: `black-forest-labs/FLUX.1-schnell`

INPUT

```ts
import Together from "together-ai";

const together = new Together();

const response = await together.images.create({
  model: "black-forest-labs/FLUX.1-schnell",
  prompt: "",
  steps: 3,
});
console.log(response.data[0].b64_json);
```

OUTPUT

```json
{
  "data": [
    {
      "b64_json": "<base64-encoded-image-data>",
      "revised_prompt": "<revised-prompt-if-applicable>"
    }
  ]
}
```
