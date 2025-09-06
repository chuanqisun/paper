import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { from, Observable } from "rxjs";
import type { ApiKeys } from "./storage";

export interface TestConnectionRequest {
  provider: "openai" | "gemini";
  apiKeys: ApiKeys;
}

export function testOpenAIConnection(apiKey: string): Observable<string> {
  const request = async (): Promise<string> => {
    const openai = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true,
    });

    const response = await openai.responses.create({
      model: "gpt-5-nano",
      input: "Please respond with exactly 'OpenAI test success!'",
      max_output_tokens: 32,
      reasoning: { effort: "minimal" },
      text: { verbosity: "low" },
    });

    if (response.output && response.output.length > 0) {
      const content = response.output
        .find((item) => item.type === "message")
        ?.content.find((item) => item.type === "output_text");
      if (!content) return "error";
      return content.text;
    }

    return "No response received from OpenAI";
  };

  return from(request());
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

    case "gemini":
      if (!apiKeys.gemini) {
        throw new Error("Gemini API key is not set");
      }
      return testGeminiConnection(apiKeys.gemini);

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
