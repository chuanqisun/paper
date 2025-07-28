import { from, Observable } from "rxjs";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "openai" | "together";
  apiKeys: ApiKeys;
}

export function testOpenAIConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
    const { default: OpenAI } = await import("openai");

    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.responses.create({
      model: "gpt-4.1",
      input: "Please respond with exactly 'OpenAI test success!'",
      max_output_tokens: 16,
    });

    if (response.output && response.output.length > 0) {
      const firstMessage = response.output[0];
      if (firstMessage.type === "message" && firstMessage.content && firstMessage.content.length > 0) {
        const content = firstMessage.content[0];
        if (content.type === "output_text") {
          return content.text;
        }
      }
    }

    return "No response received from OpenAI";
  };

  return from(request());
}

export function testTogetherConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
    try {
      const { default: Together } = await import("together-ai");

      const together = new Together({
        apiKey,
      });

      const response = await together.images.create({
        model: "black-forest-labs/FLUX.1-schnell-Free",
        prompt: "A green checkmark",
        steps: 3,
      });

      if (response.data && response.data.length > 0) {
        const imageData = response.data[0];
        if ("b64_json" in imageData && imageData.b64_json) {
          return `data:image/png;base64,${imageData.b64_json}`;
        } else if ("url" in imageData && imageData.url) {
          return imageData.url;
        }
      }

      return "Together.ai test failed: No image data received";
    } catch (error) {
      return `Together.ai test failed: ${error instanceof Error ? error.message : "Unknown error"}`;
    }
  };

  return from(request());
}

export function testConnection({ provider, apiKeys }: TestConnectionRequest): Observable<string> {
  switch (provider) {
    case "openai":
      if (!apiKeys.openai) {
        throw new Error("OpenAI API key is not set");
      }
      return testOpenAIConnection(apiKeys.openai);

    case "together":
      if (!apiKeys.together) {
        throw new Error("Together.ai API key is not set");
      }
      return testTogetherConnection(apiKeys.together);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
