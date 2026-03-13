import { useState, useRef, useEffect } from "react";
import { Send, Mic, Bot, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/hooks/useI18n";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

export default function AIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const { t, language } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestions = [t("assistant.suggestion1"), t("assistant.suggestion2"), t("assistant.suggestion3")];

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sendMessage = async (text?: string) => {
    const msg = text || input;
    if (!msg.trim() || loading) return;
    setInput("");

    const userMsg: Message = { role: "user", content: msg };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-health", {
        body: { action: "chat", data: { message: msg, language } },
      });

      const reply = data?.response || data?.error || t("assistant.failed");
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: t("assistant.failed") }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      <div>
        <h1 className="text-3xl font-bold">{t("assistant.title")}</h1>
        <p className="text-muted-foreground">{t("assistant.description")}</p>
      </div>

      <div className="flex-1 overflow-y-auto py-6">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <p className="text-lg font-semibold">{t("assistant.hello")}, {profile?.name || "there"}! 👋</p>
            <p className="text-muted-foreground mt-1">{t("assistant.onlyHealth")}</p>
            <div className="flex gap-2 mt-6 flex-wrap justify-center">
              {suggestions.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="px-4 py-2 rounded-full border border-border text-sm hover:bg-accent transition-colors">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-card border border-border"
                }`}>
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : msg.content}
                </div>
              </motion.div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-card border border-border rounded-2xl px-4 py-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-sm mb-3">
        <AlertCircle className="h-4 w-4 text-warning shrink-0" />
        {t("common.consultDoctor")}
      </div>

      <div className="flex items-center gap-2 border border-border rounded-xl p-2 bg-card">
        <button className="p-2 hover:bg-accent rounded-lg transition-colors">
          <Mic className="h-5 w-5 text-muted-foreground" />
        </button>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder={t("assistant.placeholder")} className="flex-1 bg-transparent outline-none text-sm" />
        <Button size="icon" onClick={() => sendMessage()} disabled={!input.trim() || loading}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
