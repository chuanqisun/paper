import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { from, Observable } from "rxjs";
import { map } from "rxjs/operators";
import { generateImage, type FluxConnection, type GenerateImageOptions } from "../design/generate-image";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "openai" | "together" | "gemini";
  apiKeys: ApiKeys;
}

export function testOpenAIConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
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
  const connection: FluxConnection = { apiKey };
  const options: GenerateImageOptions = {
    prompt: "A green checkmark",
    width: 400,
    height: 400,
    model: "black-forest-labs/FLUX.1-schnell-Free",
  };

  return generateImage(connection, options).pipe(map((result) => result.url));
}

export function testGeminiConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
    const ai = new GoogleGenAI({
      apiKey,
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
            text: "Please respond with exactly 'Gemini test success!'",
          },
        ],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      config,
      contents,
    });

    let fullText = "";
    for await (const chunk of response) {
      if (chunk.text) {
        fullText += chunk.text;
      }
    }

    return fullText || "No response received from Gemini";
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

    case "gemini":
      if (!apiKeys.gemini) {
        throw new Error("Gemini API key is not set");
      }
      return testGeminiConnection(apiKeys.gemini);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
