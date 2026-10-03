import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { aiTutorApi } from "@/services/api";
import { PageHeader, Button, Card } from "@/components/shared";
import { Send, Bot, User, Lightbulb, MessageCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { AiMessage } from "@/types";

export default function AITutorPage() {
  const [message, setMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useQuery({
    queryKey: ["ai-conversations"],
    queryFn: () => aiTutorApi.getConversations(),
  });

  const chatMutation = useMutation({
    mutationFn: (data: { message: string; conversationId?: string }) => aiTutorApi.chat(data),
    onSuccess: (res) => {
      const data = res.data.data;
      setConversationId(data.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "user", content: message, timestamp: new Date().toISOString() },
        { id: (Date.now() + 1).toString(), role: "assistant", content: data.response, timestamp: new Date().toISOString() },
      ]);
      setMessage("");
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!message.trim()) return;
    chatMutation.mutate({ message, conversationId: conversationId || undefined });
  };

  return (
    <div>
      <PageHeader title="AI Tutor" subtitle="Ask questions about nursing concepts" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg border border-gray-200 flex flex-col" style={{ height: "600px" }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-12">
                  <Bot size={48} className="mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500">Ask me anything about nursing!</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {["What are vital signs?", "Explain the nursing process", "How to assess pain?"].map((q) => (
                      <button
                        key={q}
                        onClick={() => setMessage(q)}
                        className="px-3 py-1.5 text-xs bg-primary-50 text-primary-700 rounded-full hover:bg-primary-100"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
                  {m.role !== "user" && (
                    <div className="p-2 bg-primary-100 rounded-lg h-fit">
                      <Bot size={16} className="text-primary-600" />
                    </div>
                  )}
                  <div className={`max-w-[75%] px-4 py-2.5 rounded-lg text-sm ${
                    m.role === "user" ? "bg-primary-600 text-white" : "bg-gray-100 text-gray-900"
                  }`}>
                    {m.role === "user" ? (
                      m.content
                    ) : (
                      <div className="prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-strong:text-inherit prose-headings:my-2">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                  {m.role === "user" && (
                    <div className="p-2 bg-gray-200 rounded-lg h-fit">
                      <User size={16} className="text-gray-600" />
                    </div>
                  )}
                </div>
              ))}
              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg h-fit">
                    <Bot size={16} className="text-primary-600" />
                  </div>
                  <div className="bg-gray-100 px-4 py-3 rounded-lg">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.1s]" />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask a nursing question..."
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none text-sm"
                  disabled={chatMutation.isPending}
                />
                <Button onClick={handleSend} disabled={chatMutation.isPending || !message.trim()}>
                  <Send size={16} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <h3 className="font-medium text-sm mb-3 flex items-center gap-1.5">
              <Lightbulb size={14} className="text-yellow-500" />
              Suggested Questions
            </h3>
            <div className="space-y-2">
              {["What is NANDA nursing diagnosis?", "Explain medication reconciliation", "How to perform head-to-toe assessment?"].map((q) => (
                <button
                  key={q}
                  onClick={() => setMessage(q)}
                  className="w-full text-left p-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg"
                >
                  {q}
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <h3 className="font-medium text-sm mb-3 flex items-center gap-1.5">
              <MessageCircle size={14} className="text-blue-500" />
              Recent Conversations
            </h3>
            <div className="space-y-1">
              {(conversations?.data?.data?.items ?? []).slice(0, 5).map((c: Record<string, unknown>) => (
                <button
                  key={String(c.id)}
                  className="w-full text-left p-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg truncate"
                >
                  {String(c.title || "Untitled")}
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
