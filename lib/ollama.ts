type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
  images?: string[];
};

export async function askOllama(messages: OllamaMessage[], model?: string) {
  const response = await fetch("http://localhost:11434/api/chat", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: model || process.env.OLLAMA_MODEL || "llama3.2",
      messages,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const data = await response.json();
  return data.message?.content || "No response returned from Ollama.";
}
