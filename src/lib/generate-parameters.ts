import { JSONParser } from "@streamparser/json";
import { OpenAI } from "openai";
import { Observable } from "rxjs";

export interface StreamParametersParams {
  parti: string;
  concepts: { name: string; description: string }[];
  artifacts: { name: string; description: string }[];
  domain: string;
  existingParameters: string[];
  rejectedParameters: string[];
  apiKey: string;
}

export interface Parameter {
  name: string;
  description: string;
}

export function streamParameters$(params: StreamParametersParams): Observable<Parameter> {
  return new Observable<Parameter>((subscriber) => {
    const openai = new OpenAI({
      dangerouslyAllowBrowser: true,
      apiKey: params.apiKey,
    });

    const parser = new JSONParser();

    // Wire up parser event to emit parameters
    parser.onValue = (entry) => {
      // Check if this is an array item under the "parameters" key
      if (typeof entry.key === "number" && entry.parent && entry.value && typeof entry.value === "object") {
        const parameter = entry.value as unknown as Parameter;
        if (parameter.name && parameter.description) {
          subscriber.next(parameter);
        }
      }
    };

    // Call OpenAI responses API in structured mode, streaming output
    (async () => {
      try {
        const conceptsList = params.concepts.map((c) => `- ${c.name}: ${c.description}`).join("\n");
        const artifactsList = params.artifacts.map((a) => `- ${a.name}: ${a.description}`).join("\n");

        const existingList =
          params.existingParameters.length > 0
            ? `\n\nExisting parameters (avoid repetition):\n${params.existingParameters.map((p) => `- ${p}`).join("\n")}`
            : "";

        const rejectedList =
          params.rejectedParameters.length > 0
            ? `\n\nRejected parameters (do not suggest these):\n${params.rejectedParameters.map((p) => `- ${p}`).join("\n")}`
            : "";

        const isIncremental = params.existingParameters.length > 0;
        const count = isIncremental ? 2 : 3;

        const prompt = `
Generate design parameters for ${params.domain} based on this Parti, concepts, and artifacts:

\`\`\`parti
${params.parti}
\`\`\`

\`\`\`concepts
${conceptsList}
\`\`\`

\`\`\`artifacts
${artifactsList}
\`\`\`${existingList}${rejectedList}

Generate ${count} design parameters that represent specific design decisions that a designer must make for ${params.domain}. Each parameter should be a decision that is usually associated with a list of possible choices.

Parameter name should be concise and clear, representing a specific design decision (e.g., "Material" for clothing, "Location" for art installation).
Parameter description should be a short sentence that defines what this design decision encompasses, including example values that can be assigned to this parameter. This provides clarity about the scope and potential choices without introducing bias into the design process.

Respond in this JSON format:
{
  "parameters": [
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

export function regenerateParameterDescription$(params: {
  parameterName: string;
  domain: string;
  apiKey: string;
  existingParameters?: Parameter[];
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
                content: `Generate a description for a design parameter in the context of ${params.domain}. The description should be a short sentence that defines what this design decision encompasses, including example values that can be assigned to this parameter. This provides clarity about the scope and potential choices without introducing bias into the design process.`,
              },

              // Few-shot examples using existing parameters
              ...(params.existingParameters ?? []).flatMap((example) => [
                { role: "user" as const, content: example.name },
                { role: "assistant" as const, content: example.description },
              ]),

              { role: "user", content: params.parameterName },
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
