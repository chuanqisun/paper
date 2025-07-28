---
applyTo: "**"
---

# System Architecture

A pipeline for mood board based prodcut designs generation.

## Workflow

A Human-AI co-iterative loop. Non-linear progression. End with product requirements documentation (PRD)

| Step               | Human                     | AI                                                       |
| ------------------ | ------------------------- | -------------------------------------------------------- |
| Parti              | Write down one "big idea" | Suggest alternatives                                     |
| Conceptual Map     | Explore related concepts  | Suggest and define concepts                              |
| Parameterization   | Specify domain parameters | Suggest additional aspects, and suggest attribute values |
| Artifact Synthesis | Steer AI with preference  | Generate artifacts while adhering to latest preference   |
| Renderings         | Steer with PRD            | Generate PRD and render products                         |

## Model access

- Use OpenAI SDK response API for text gen
- Use blackforest for image gen

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

## Blackforest docs

INPUT

```ts
const url = "https://api.bfl.ai/v1/flux-kontext-pro";
const options = {
  method: "POST",
  headers: { "x-key": "<api-key>", "Content-Type": "application/json" },
  body: '{"prompt":"ein fantastisches bild","input_image":"<string>","input_image_2":"<string>","input_image_3":"<string>","input_image_4":"<string>","seed":42,"aspect_ratio":"<string>","output_format":"jpeg","webhook_url":"<string>","webhook_secret":"<string>","prompt_upsampling":false,"safety_tolerance":2}',
};

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

OUTPUT (200)

```json
{
  "id": "<string>",
  "polling_url": "<string>"
}
```

OUTPUT (422)

```json
{
  "detail": [
    {
      "loc": ["<string>"],
      "msg": "<string>",
      "type": "<string>"
    }
  ]
}
```

POLLING

```ts
const url = "https://api.bfl.ai/v1/get_result";
const options = { method: "GET", body: undefined };

try {
  const response = await fetch(url, options);
  const data = await response.json();
  console.log(data);
} catch (error) {
  console.error(error);
}
```

OUTPUT (200)

```json
{
  "id": "<string>",
  "status": "Task not found",
  "result": "<any>",
  "progress": 123,
  "details": {},
  "preview": {}
}
```

Status options: Task not found, Pending, Request Moderated, Content Moderated, Ready, Error

OUTPUT (422)

```json
{
  "id": "<string>",
  "status": "Task not found",
  "result": "<any>",
  "progress": 123,
  "details": {},
  "preview": {}
}
```
