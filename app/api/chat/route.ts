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

    const reply = await askOllama([
      {
        role: "system",
        content:
          "Your name is Luna. You are an offline laptop AI assistant. Answer normal questions normally. Keep answers warm, practical, and concise. Do not use Markdown bold markers. Do not claim internet access.",
      },
      {
        role: "user",
        content: message,
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
