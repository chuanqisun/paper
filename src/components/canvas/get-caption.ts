import OpenAI from "openai";

export async function getCaption(src: string, apiKey: string): Promise<string | null> {
  try {
    const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true });
    const response = await openai.responses.create({
      model: "gpt-5-mini",
      reasoning: {
        effort: "minimal",
      },
      text: {
        verbosity: "low",
      },
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Describe this image in a short caption." },
            { type: "input_image", image_url: src, detail: "auto" },
          ],
        },
      ],
    });
    const caption = response.output
      .find((item) => item.type === "message")
      ?.content.find((item) => item.type === "output_text")?.text;
    return caption || null;
  } catch (error) {
    console.error("Failed to generate caption:", error);
    return null;
  }
}
