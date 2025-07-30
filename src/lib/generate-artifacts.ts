import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";

export interface StreamArtifactsParams {
  parti: string;
  concepts: { name: string; description: string }[];
  existingArtifacts: string[];
  rejectedArtifacts: string[];
  apiKey: string;
}

export interface Artifact {
  name: string;
  description: string;
}

export function streamArtifacts$(params: StreamArtifactsParams): Observable<Artifact> {
  return new Observable<Artifact>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit artifacts
    parser.onValue = (entry) => {
      // Check if this is an array item under the "artifacts" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const artifact = entry.value as unknown as Artifact;
        if (artifact.name && artifact.description) {
          subscriber.next(artifact);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      try {
        const conceptsList = params.concepts.map((c) => `- ${c.name}: ${c.description}`).join("\n");

        const existingList =
          params.existingArtifacts.length > 0
            ? `\n\nExisting artifacts (avoid repetition):\n${params.existingArtifacts.map((a) => `- ${a}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedArtifacts.length > 0
            ? `\n\nRejected artifacts (do not suggest these):\n${params.rejectedArtifacts.map((a) => `- ${a}`).join("\n")}`
            : "";

        const isIncremental = params.existingArtifacts.length > 0;
        const count = isIncremental ? 3 : 5;

        const prompt = `
Generate moodboard artifacts based on this Parti and concepts:

\`\`\`parti
${params.parti}
\`\`\`

\`\`\`concepts
${conceptsList}
\`\`\`${existingList}${rejectedList}

Generate ${count} diverse artifacts that would be commonly seen in a moodboard. Each artifact should represent multi-sensory aspects of the Parti and be suitable for image generation.
An artifact should be grounded in the real world and human's lived experience, e.g. an object, material, texture, color scheme, sound, smell, emotion, or environment that evokes the intended experience of the design.

Artifact name should be very short (one word or short phrase).
Artifact description should be one detailed sentence including subject, scene, and style for AI image generation.

Respond in this JSON format:
{
  "artifacts": [
    {
      "name": "string",
      "description": "string"
    }
  ]
}
        `.trim();

        const responseStream = await openai.responses.create({
          model: "gpt-4.1",
          input: prompt,
          text: { format: { type: "json_object" } },
          stream: true,
        });

        for await (const chunk of responseStream) {
          if (chunk.type === "response.output_text.delta") {
            parser.write(chunk.delta);
          }
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();
  });
}

export function regenerateArtifactDescription$(params: {
  artifactName: string;
  apiKey: string;
  existingArtifacts?: Artifact[];
}): Observable<string> {
  return new Observable<string>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    (async () => {
      try {
        const response = await openai.responses.create(
          {
            model: "gpt-4.1",
            input: [
              {
                role: "developer",
                content:
                  "Generate a detailed description for a moodboard artifact. The description should be one detailed sentence including subject, scene, and style for AI image generation. The artifact should be grounded in the real world and human's lived experience.",
              },

              // Few-shot examples using existing artifacts
              ...(params.existingArtifacts ?? []).flatMap((example) => [
                { role: "user" as const, content: example.name },
                { role: "assistant" as const, content: example.description },
              ]),

              { role: "user", content: params.artifactName },
            ],
          },
          {
            signal: abortController.signal,
          },
        );

        const message = response.output[0];
        if (message?.type === "message" && "content" in message) {
          const content = message.content?.[0];
          if (content?.type === "output_text") {
            subscriber.next(content.text.trim());
          }
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}

export function generateArtifactFromImage$(params: {
  imageBase64: string;
  apiKey: string;
  existingArtifacts?: Artifact[];
}): Observable<Artifact> {
  return new Observable<Artifact>((subscriber) => {
    const abortController = new AbortController();

    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    (async () => {
      try {
        const existingContext = params.existingArtifacts?.length
          ? `\n\nFor consistency, here are examples of existing artifacts:\n${params.existingArtifacts
              .map((a) => `- ${a.name}: ${a.description}`)
              .join("\n")}`
          : "";

        const response = await openai.responses.create(
          {
            model: "gpt-4.1",
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: `Analyze this image and generate a moodboard artifact entry for it.  

Generate a name and description following these guidelines:
- Name should be very short (one word or short phrase)
- Description should be one detailed sentence including subject, scene, and style for AI image generation
- The artifact should be grounded in the real world and human's lived experience${existingContext}

Respond in this JSON format:
{
  "name": "string",
  "description": "string"
}`,
                  },
                  {
                    type: "input_image",
                    image_url: "data:image/jpeg;base64," + params.imageBase64,
                    detail: "auto",
                  },
                ],
              },
            ],
            text: { format: { type: "json_object" } },
          },
          {
            signal: abortController.signal,
          },
        );

        const message = response.output[0];
        if (message?.type === "message" && "content" in message) {
          const content = message.content?.[0];
          if (content?.type === "output_text") {
            try {
              const parsed = JSON.parse(content.text.trim()) as Artifact;
              if (parsed.name && parsed.description) {
                subscriber.next(parsed);
              } else {
                subscriber.error(new Error("Invalid artifact format in response"));
              }
            } catch (parseError) {
              subscriber.error(new Error("Failed to parse JSON response"));
            }
          }
        }
        subscriber.complete();
      } catch (error) {
        subscriber.error(error);
      }
    })();

    return () => {
      abortController.abort();
    };
  });
}

export async function fileToDataUrl(file: File): Promise<string> {
  const reader = new FileReader();
  return new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
