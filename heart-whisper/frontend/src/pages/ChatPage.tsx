import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "../components/Sidebar";
import ChatWindow from "../components/ChatWindow";
import MessageInput from "../components/MessageInput";
import NewChatDialog from "../components/NewChatDialog";
import { apiFetch, connectSSE } from "../api/client";
import { Conversation, ConversationDetail, Message, User } from "../types";

interface ChatPageProps {
  user: User;
  onLogout: () => void;
}

function ChatPage({ user, onLogout }: ChatPageProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewDialog, setShowNewDialog] = useState(false);

  const chatWindowRef = useRef<HTMLDivElement>(null);

  const loadConversations = useCallback(async () => {
    try {
      const list = await apiFetch<Conversation[]>("/conversations");
      setConversations(list);
    } catch {
      // silent
    }
  }, []);

  const loadConversation = useCallback(async (id: number) => {
    try {
      const detail = await apiFetch<ConversationDetail>(`/conversations/${id}`);
      setMessages(detail.messages || []);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleSelectConv = (id: number) => {
    setActiveConvId(id);
    setStreaming("");
    loadConversation(id);
  };

  const handleNewConversation = async (firstMessage: string, title?: string) => {
    setSending(true);
    setShowNewDialog(false);

    try {
      const body: Record<string, string> = { first_message: firstMessage };
      if (title) body.title = title;
      const conv = await apiFetch<Conversation>("/conversations", {
        method: "POST",
        body: JSON.stringify(body),
      });

      await loadConversations();
      setActiveConvId(conv.id);
      setMessages([
        {
          id: 0,
          conversation_id: conv.id,
          role: "user",
          content: firstMessage,
          created_at: new Date().toISOString(),
        },
      ]);

      // Stream the AI response
      setStreaming("");
      await connectSSE(`/conversations/${conv.id}/chat`, { content: firstMessage }, {
        onToken: (token) => {
          setStreaming((prev) => prev + token);
        },
        onDone: () => {
          setStreaming((prev) => {
            const assistantMsg: Message = {
              id: Date.now(),
              conversation_id: conv.id,
              role: "assistant",
              content: prev,
              created_at: new Date().toISOString(),
            };
            setMessages((msgs) => [...msgs, assistantMsg]);
            return "";
          });
          loadConversations();
        },
        onError: (err) => {
          setStreaming("");
          alert(err);
        },
      });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "创建失败");
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (content: string) => {
    if (!activeConvId) return;

    setSending(true);
    const userMsg: Message = {
      id: Date.now(),
      conversation_id: activeConvId,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setStreaming("");

    await connectSSE(`/conversations/${activeConvId}/chat`, { content }, {
      onToken: (token) => {
        setStreaming((prev) => prev + token);
      },
      onDone: () => {
        setStreaming((prev) => {
          const assistantMsg: Message = {
            id: Date.now(),
            conversation_id: activeConvId,
            role: "assistant",
            content: prev,
            created_at: new Date().toISOString(),
          };
          setMessages((msgs) => [...msgs, assistantMsg]);
          return "";
        });
        loadConversations();
      },
      onError: (err) => {
        setStreaming("");
        alert(err);
      },
    });

    setSending(false);
  };

  const handleDeleteConv = async (id: number) => {
    try {
      await apiFetch(`/conversations/${id}`, { method: "DELETE" });
      await loadConversations();
      if (activeConvId === id) {
        setActiveConvId(null);
        setMessages([]);
        setStreaming("");
      }
    } catch {
      // silent
    }
  };

  return (
    <div className="flex h-screen bg-white">
      <Sidebar
        conversations={conversations}
        activeConvId={activeConvId}
        onSelect={handleSelectConv}
        onNew={() => setShowNewDialog(true)}
        onDelete={handleDeleteConv}
        username={user.username}
        onLogout={onLogout}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {activeConvId ? (
          <>
            <div className="flex-1 overflow-hidden" ref={chatWindowRef}>
              <ChatWindow messages={messages} streaming={streaming} />
            </div>
            <MessageInput onSend={handleSend} disabled={sending} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-6xl mb-4">💝</div>
              <h2 className="text-xl font-medium text-gray-600 mb-2">心声 · Heart Whisper</h2>
              <p className="text-sm">选择一段对话，或创建一个新对话开始</p>
              <button
                onClick={() => setShowNewDialog(true)}
                className="mt-6 px-6 py-2.5 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
              >
                开始新对话
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewDialog && (
        <NewChatDialog
          onClose={() => setShowNewDialog(false)}
          onSubmit={handleNewConversation}
        />
      )}
    </div>
  );
}

export default ChatPage;
