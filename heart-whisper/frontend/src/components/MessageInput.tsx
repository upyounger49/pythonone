import { useState, useRef, KeyboardEvent } from "react";

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled: boolean;
}

function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    const content = input.trim();
    if (!content || disabled) return;
    onSend(content);
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-gray-200 p-4 bg-white">
      <div className="max-w-3xl mx-auto flex items-end gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你遇到的感情困扰或聊天场景..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
          style={{ maxHeight: "120px" }}
        />
        <button
          onClick={handleSend}
          disabled={disabled || !input.trim()}
          className="px-5 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          发送
        </button>
      </div>
    </div>
  );
}

export default MessageInput;
