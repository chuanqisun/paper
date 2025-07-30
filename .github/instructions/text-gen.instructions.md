---
applyTo: "**/src/lib/**/*.ts"
---

# LLM Text Generation

## OpenAI SDK docs

INPUT

```ts
import OpenAI from "openai";

const openai = new OpenAI();

const response = await openai.responses.create({
  model: "gpt-4.1",
  input: "Tell me a three sentence bedtime story about a unicorn.",
});

console.log(response);
```

OUTPUT

```json
{
  "id": "resp_67ccd2bed1ec8190b14f964abc0542670bb6a6b452d3795b",
  "created_at": 1741476542,
  "status": "completed",
  "model": "gpt-4.1-2025-04-14",
  "output": [
    {
      "type": "message",
      "id": "msg_67ccd2bf17f0819081ff3bb2cf6508e60bb6a6b452d3795b",
      "status": "completed",
      "role": "assistant",
      "content": [
        {
          "type": "output_text",
          "text": "In a peaceful grove beneath a silver moon, a unicorn named Lumina discovered a hidden pool that reflected the stars. As she dipped her horn into the water, the pool began to shimmer, revealing a pathway to a magical realm of endless night skies. Filled with wonder, Lumina whispered a wish for all who dream to find their own hidden magic, and as she glanced back, her hoofprints sparkled like stardust.",
          "annotations": []
        }
      ]
    }
  ]
}
```

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
