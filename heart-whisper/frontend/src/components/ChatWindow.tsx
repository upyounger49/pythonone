import { useEffect, useRef } from "react";
import { Message } from "../types";

interface ChatWindowProps {
  messages: Message[];
  streaming: string;
}

function ChatWindow({ messages, streaming }: ChatWindowProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  const allItems: Array<Message | { role: "assistant"; content: string; isStreaming: true }> = [
    ...messages,
    ...(streaming
      ? [{ role: "assistant" as const, content: streaming, isStreaming: true as const }]
      : []),
  ];

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      {allItems.length === 0 && (
        <div className="flex items-center justify-center h-full text-gray-400 text-sm">
          发送你的第一条消息
        </div>
      )}

      {allItems.map((item, idx) => {
        const isUser = item.role === "user";
        return (
          <div
            key={idx}
            className={`flex ${isUser ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                isUser
                  ? "bg-rose-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {isUser ? (
                <p className="text-sm whitespace-pre-wrap">{item.content}</p>
              ) : (
                <div
                  className="text-sm prose prose-sm max-w-none prose-headings:text-gray-800 prose-headings:font-semibold prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-gray-900"
                  dangerouslySetInnerHTML={{
                    __html: renderMarkdown(item.content),
                  }}
                />
              )}
            </div>
          </div>
        );
      })}

      <div ref={bottomRef} />
    </div>
  );
}

function renderMarkdown(text: string): string {
  let html = text;

  // Headers
  html = html.replace(/^### (.+)$/gm, "<h3 class='text-base font-semibold mt-3 mb-1'>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2 class='text-lg font-semibold mt-4 mb-2'>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1 class='text-xl font-bold mt-4 mb-2'>$1</h1>");

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>");
  html = html.replace(
    /((?:<li class='ml-4 list-disc'>.+<\/li>\n?)+)/g,
    "<ul class='my-1'>$1</ul>"
  );

  // Blockquotes (the AI disclaimer)
  html = html.replace(
    /^> (.+)$/gm,
    "<blockquote class='border-l-2 border-gray-300 pl-3 my-2 text-gray-500 text-xs italic'>$1</blockquote>"
  );

  // Line breaks
  html = html.replace(/\n\n/g, "<br/><br/>");
  html = html.replace(/\n/g, "<br/>");

  return html;
}

export default ChatWindow;
