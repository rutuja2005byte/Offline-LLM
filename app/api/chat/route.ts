import { NextResponse } from "next/server";
import { askOllama } from "@/lib/ollama";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const messages = await prisma.chatMessage.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 20,
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message?.trim()) {
      return NextResponse.json({ reply: "Ask me something first." }, { status: 400 });
    }

    const uploads = await prisma.upload.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
    });
    const uploadContext = uploads
      .map((upload) =>
        [
          `File: ${upload.name}`,
          upload.extracted ? `Extracted text:\n${upload.extracted}` : "",
          `Analysis:\n${upload.analysis}`,
        ]
          .filter(Boolean)
          .join("\n")
      )
      .join("\n\n---\n\n");

    const reply = await askOllama([
      {
        role: "system",
        content:
          "You are an offline laptop AI assistant. Answer from the user's local uploaded files when they are relevant. If the answer is not in the files, say that plainly. Be practical and concise. Do not claim internet access.",
      },
      {
        role: "user",
        content: uploadContext
          ? `Local uploaded file context:\n${uploadContext}\n\nUser question:\n${message}`
          : message,
      },
    ]);

    const saved = await prisma.chatMessage.create({
      data: {
        prompt: message,
        reply,
      },
    });

    return NextResponse.json({
      reply,
      message: saved,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        reply: "Something went wrong. Check that Ollama is running locally.",
      },
      {
        status: 500,
      }
    );
  }
}
