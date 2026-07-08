import { useState } from "react";

interface NewChatDialogProps {
  onClose: () => void;
  onSubmit: (firstMessage: string, title?: string) => void;
}

function NewChatDialog({ onClose, onSubmit }: NewChatDialogProps) {
  const [firstMessage, setFirstMessage] = useState("");
  const [title, setTitle] = useState("");

  const handleSubmit = () => {
    const msg = firstMessage.trim();
    if (!msg) return;
    onSubmit(msg, title.trim() || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg mx-4">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">开始新对话</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              对话标题（可选）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="留空则自动生成"
              maxLength={30}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-400 mt-1">不填的话，AI 会根据你的第一条消息自动生成标题</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              描述你的情况
            </label>
            <textarea
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="描述你遇到的感情困扰、和伴侣的相处场景，或者你想了解的问题..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent resize-none"
              autoFocus
            />
            <p className="text-xs text-gray-400 mt-1">
              例如：和女朋友在聊天中发现她总是不理解我的意思，我想知道该怎么改进沟通方式
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={!firstMessage.trim()}
            className="px-6 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            开始对话
          </button>
        </div>
      </div>
    </div>
  );
}

export default NewChatDialog;
