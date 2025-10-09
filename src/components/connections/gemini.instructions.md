---
applyTo: "connections/**/*.ts"
---

# Google AI (Gemini)

## Text Gen

```ts
import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
  };
  const model = "gemini-2.5-flash-lite";
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });
  let fileIndex = 0;
  for await (const chunk of response) {
    console.log(chunk.text);
  }
}

main();
```

## Generating JSON

To constrain the model to generate JSON, configure a `responseSchema`. The model will then respond to any prompt with JSON-formatted output.

```javascript
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "List a few popular cookie recipes, and include the amounts of ingredients.",
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            recipeName: {
              type: Type.STRING,
            },
            ingredients: {
              type: Type.ARRAY,
              items: {
                type: Type.STRING,
              },
            },
          },
          propertyOrdering: ["recipeName", "ingredients"],
        },
      },
    },
  });

  console.log(response.text);
}

main();
```

### Example Output

The output might look like this:

```json
[
  {
    "recipeName": "Chocolate Chip Cookies",
    "ingredients": [
      "1 cup (2 sticks) unsalted butter, softened",
      "3/4 cup granulated sugar",
      "3/4 cup packed brown sugar",
      "1 teaspoon vanilla extract",
      "2 large eggs",
      "2 1/4 cups all-purpose flour",
      "1 teaspoon baking soda",
      "1 teaspoon salt",
      "2 cups chocolate chips"
    ]
  },
  ...
]
```

## Image Gen

```ts
import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({
    apiKey: "YOUR_GEMINI_API_KEY", // In browser, get from user input or secure storage
  });
  const config = {
    responseModalities: ["IMAGE", "TEXT"],
  };
  const model = "gemini-2.5-flash-image-preview";
  const contents = [
    {
      role: "user",
      parts: [
        {
          text: `INSERT_INPUT_HERE`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

  let imageUrls: string[] = [];
  let textContent = "";

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }

    const parts = chunk.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData) {
        // Create a portable data URL for the image
        const { mimeType, data } = part.inlineData;
        const imageUrl = `data:${mimeType};base64,${data}`;
        imageUrls.push(imageUrl);
        console.log("Generated image URL:", imageUrl);
      } else if (part.text) {
        textContent += part.text;
        console.log("Text response:", part.text);
      }
    }
  }

  // Return or use the image URLs and text
  return { imageUrls, textContent };
}

main();
```

## Image Edit

```ts
import { GoogleGenAI } from "@google/genai";

async function main() {
  const ai = new GoogleGenAI({
    apiKey: "YOUR_GEMINI_API_KEY", // In browser, get from user input or secure storage
  });
  const config = {
    responseModalities: ["IMAGE", "TEXT"],
  };
  const model = "gemini-2.5-flash-image-preview";
  const contents = [
    {
      role: "user",
      parts: [
        {
          inlineData: {
            data: `...data url to image`, // Replace with actual base64 data without data: prefix
            mimeType: `image/jpeg`,
          },
        },
        {
          inlineData: {
            data: `...data url to image`, // Replace with actual base64 data without data: prefix
            mimeType: `image/jpeg`,
          },
        },
        {
          text: `Blend the two images into one`,
        },
      ],
    },
  ];

  const response = await ai.models.generateContentStream({
    model,
    config,
    contents,
  });

  let imageUrls: string[] = [];
  let textContent = "";

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue;
    }

    const parts = chunk.candidates[0].content.parts;
    for (const part of parts) {
      if (part.inlineData) {
        // Create a portable data URL for the image
        const { mimeType, data } = part.inlineData;
        const imageUrl = `data:${mimeType};base64,${data}`;
        imageUrls.push(imageUrl);
        console.log("Generated image URL:", imageUrl);
      } else if (part.text) {
        textContent += part.text;
        console.log("Text response:", part.text);
      }
    }
  }

  // Return or use the image URLs and text
  return { imageUrls, textContent };
}

main();
```
