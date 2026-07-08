import { useState } from "react";
import { Conversation } from "../types";

interface SidebarProps {
  conversations: Conversation[];
  activeConvId: number | null;
  onSelect: (id: number) => void;
  onNew: () => void;
  onDelete: (id: number) => void;
  username: string;
  onLogout: () => void;
}

function Sidebar({
  conversations,
  activeConvId,
  onSelect,
  onNew,
  onDelete,
  username,
  onLogout,
}: SidebarProps) {
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirmDelete === id) {
      onDelete(id);
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <button
          onClick={onNew}
          className="w-full py-2 bg-rose-600 text-white rounded-lg text-sm font-medium hover:bg-rose-700 transition-colors"
        >
          + 新建对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="p-4 text-sm text-gray-400 text-center">
            暂无对话
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`group px-4 py-3 cursor-pointer border-b border-gray-100 transition-colors ${
                activeConvId === conv.id
                  ? "bg-rose-50 border-l-4 border-l-rose-600"
                  : "hover:bg-gray-100 border-l-4 border-l-transparent"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium text-gray-800 truncate flex-1">
                  {conv.title}
                </div>
                <button
                  onClick={(e) => handleDeleteClick(e, conv.id)}
                  className={`ml-2 text-xs transition-all ${
                    confirmDelete === conv.id
                      ? "text-red-600 font-medium"
                      : "text-gray-400 opacity-0 group-hover:opacity-100"
                  }`}
                >
                  {confirmDelete === conv.id ? "确认删除" : "×"}
                </button>
              </div>
              <div className="text-xs text-gray-400 mt-1">
                {formatDate(conv.updated_at)}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-4 border-t border-gray-200 flex items-center justify-between">
        <span className="text-sm text-gray-600 truncate">{username}</span>
        <button
          onClick={onLogout}
          className="text-xs text-gray-400 hover:text-red-600 transition-colors"
        >
          退出
        </button>
      </div>
    </div>
  );
}

function formatDate(isoStr: string): string {
  const d = new Date(isoStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours().toString().padStart(2, "0");
  const minute = d.getMinutes().toString().padStart(2, "0");
  return `${month}/${day} ${hour}:${minute}`;
}

export default Sidebar;
