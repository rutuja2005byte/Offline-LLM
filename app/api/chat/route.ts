import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const response = await fetch("http://localhost:11434/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "qwen2.5:3b", // Change if using another model
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
        stream: false,
      }),
    });

    const data = await response.json();

    return NextResponse.json({
      reply: data.message.content,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        reply: "Something went wrong.",
      },
      {
        status: 500,
      }
    );
  }
}