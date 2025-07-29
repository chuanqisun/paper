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
