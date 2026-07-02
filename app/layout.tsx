import type { Metadata } from "next";
import { Cabin, Jim_Nightshade } from "next/font/google";
import "./globals.css";

const cabin = Cabin({
  variable: "--font-cabin",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jimNightshade = Jim_Nightshade({
  variable: "--font-jim-nightshade",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Offline AI Desk",
  description: "A local Ollama workspace for chats and file analysis.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cabin.variable} ${jimNightshade.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
