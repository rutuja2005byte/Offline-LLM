import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import pdf from "pdf-parse/lib/pdf-parse";
import { prisma } from "@/lib/prisma";
import { askOllama } from "@/lib/ollama";

export const runtime = "nodejs";

const uploadDir = path.join(process.cwd(), "uploads");
const textTypes = new Set([
  "application/json",
  "application/xml",
  "text/csv",
  "text/html",
  "text/markdown",
  "text/plain",
  "text/xml",
]);

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function clip(text: string, length = 12000) {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}\n\n[Content clipped for local analysis.]`;
}

async function extractText(file: File, bytes: Buffer) {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const parsed = await pdf(bytes);
    return clip(parsed.text.trim());
  }

  if (textTypes.has(file.type) || /\.(txt|md|csv|json|xml|html|log)$/i.test(file.name)) {
    return clip(bytes.toString("utf8").trim());
  }

  return "";
}

export async function GET() {
  const uploads = await prisma.upload.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  return NextResponse.json({ uploads });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const prompt = String(formData.get("prompt") || "");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a file to analyze." }, { status: 400 });
    }

    await mkdir(uploadDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());
    const storedName = `${Date.now()}-${cleanFileName(file.name)}`;
    const storagePath = path.join(uploadDir, storedName);
    await writeFile(storagePath, bytes);

    const extracted = await extractText(file, bytes);
    const isImage = file.type.startsWith("image/");
    const visionModel = process.env.OLLAMA_VISION_MODEL?.trim();
    const basePrompt = [
      "Analyze this local upload for Luna, a private offline AI chat.",
      `File name: ${file.name}`,
      `MIME type: ${file.type || "unknown"}`,
      `Size: ${file.size} bytes`,
      prompt ? `User focus: ${prompt}` : "",
      extracted ? `Extracted content:\n${extracted}` : "",
      !extracted && !isImage ? "No text could be extracted. Summarize useful metadata and suggest what the user can do next." : "",
      isImage && !visionModel ? "This is an image, but no OLLAMA_VISION_MODEL is configured. Explain that only file metadata was analyzed." : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const analysis = await askOllama(
      [
        {
          role: "system",
          content:
            "You are a concise offline file analyst. Summarize contents, key facts, risks, and useful next actions. Use plain text headings without Markdown bold markers. Do not claim internet access.",
        },
        {
          role: "user",
          content: basePrompt,
          images: isImage && visionModel ? [bytes.toString("base64")] : undefined,
        },
      ],
      isImage && visionModel ? visionModel : undefined
    );

    const upload = await prisma.upload.create({
      data: {
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        storagePath,
        extracted: extracted || null,
        analysis,
      },
    });

    return NextResponse.json({ upload });
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unknown upload error.";

    return NextResponse.json(
      {
        error: `Could not analyze this file. ${message}`,
      },
      {
        status: 500,
      }
    );
  }
}
