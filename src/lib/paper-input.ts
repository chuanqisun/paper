export interface PaperTextInput {
  kind: "text";
  text: string;
}

export interface PaperAttachmentInput {
  kind: "attachment";
  file: File;
}

export type PaperInput = PaperTextInput | PaperAttachmentInput;

const textFileExtensions = new Set([
  "asm",
  "bat",
  "c",
  "cc",
  "conf",
  "cpp",
  "css",
  "csv",
  "cxx",
  "eml",
  "h",
  "hh",
  "htm",
  "html",
  "ics",
  "java",
  "js",
  "json",
  "jsx",
  "log",
  "markdown",
  "md",
  "mjs",
  "py",
  "rb",
  "rs",
  "sh",
  "sql",
  "svg",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

const textMimeTypes = new Set([
  "application/json",
  "application/ld+json",
  "application/sql",
  "application/typescript",
  "application/xml",
  "image/svg+xml",
]);

export function normalizePastedPaperInput(text: string | null): PaperInput | null {
  const normalizedText = text?.trim();

  if (!normalizedText) {
    return null;
  }

  return {
    kind: "text",
    text: normalizedText,
  };
}

export function hasPaperInput(input: PaperInput | null): input is PaperInput {
  return input !== null;
}

export async function pickPaperInput(): Promise<PaperInput | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";

    const resolveSelection = async () => {
      const file = input.files?.[0];

      if (!file) {
        resolve(null);
        return;
      }

      resolve(await createPaperInputFromFile(file));
    };

    input.addEventListener(
      "change",
      () => {
        void resolveSelection();
      },
      { once: true },
    );
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}

async function createPaperInputFromFile(file: File): Promise<PaperInput | null> {
  if (!isTextFile(file)) {
    return {
      kind: "attachment",
      file,
    };
  }

  return normalizePastedPaperInput(await file.text());
}

function isTextFile(file: File): boolean {
  if (file.type.startsWith("text/")) {
    return true;
  }

  if (textMimeTypes.has(file.type)) {
    return true;
  }

  const extension = file.name.split(".").pop()?.toLowerCase();

  return extension ? textFileExtensions.has(extension) : false;
}
