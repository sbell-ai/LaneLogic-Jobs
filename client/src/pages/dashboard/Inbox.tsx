import { useState, useEffect, useRef } from "react";
import { DashboardLayout } from "./DashboardLayout";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Send, ArrowLeft, Inbox as InboxIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Message } from "@shared/schema";

type ConversationWithMeta = {
  id: number;
  seekerId: number;
  employerId: number;
  jobId: number | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  otherPartyName: string;
  lastMessage: string | null;
  unreadCount: number;
};

function ThreadView({
  conversation,
  currentUserId,
  onBack,
}: {
  conversation: ConversationWithMeta;
  currentUserId: number;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: msgs = [], isLoading } = useQuery<Message[]>({
    queryKey: ["/api/conversations", conversation.id, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/conversations/${conversation.id}/messages`);
      if (!res.ok) throw new Error("Failed to load messages");
      return res.json();
    },
    refetchInterval: 10000,
  });

  useEffect(() => {
    fetch(`/api/conversations/${conversation.id}/read`, { method: "POST" }).catch(() => {});
    queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
    queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
  }, [conversation.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/conversations/${conversation.id}/messages`, { content }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/conversations", conversation.id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
    },
    onError: () => toast({ title: "Error", description: "Could not send message.", variant: "destructive" }),
  });

  const handleSend = () => {
    if (!draft.trim()) return;
    sendMutation.mutate(draft.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      <div className="flex items-center gap-3 mb-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          data-testid="button-back-inbox"
          className="rounded-full"
        >
          <ArrowLeft size={18} />
        </Button>
        <div>
          <h2 className="text-xl font-bold font-display" data-testid="text-conversation-party">{conversation.otherPartyName}</h2>
          {conversation.jobId && (
            <p className="text-xs text-muted-foreground">Re: Job #{conversation.jobId}</p>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-slate-900 rounded-2xl border border-border p-4 space-y-3 mb-4">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!isLoading && msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <MessageSquare size={32} className="mb-2 opacity-40" />
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        )}
        {msgs.map((msg) => {
          const mine = msg.senderId === currentUserId;
          return (
            <div
              key={msg.id}
              data-testid={`message-${msg.id}`}
              className={`flex ${mine ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm ${
                  mine
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-slate-100 dark:bg-slate-800 text-foreground rounded-bl-sm"
                }`}
              >
                <p>{msg.content}</p>
                <p className={`text-[10px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                  {msg.createdAt ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true }) : ""}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2">
        <Textarea
          placeholder="Type a message… (Ctrl+Enter to send)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="resize-none"
          data-testid="input-message-draft"
        />
        <Button
          onClick={handleSend}
          disabled={sendMutation.isPending || !draft.trim()}
          className="self-end"
          data-testid="button-send-message"
        >
          <Send size={16} />
        </Button>
      </div>
    </div>
  );
}

function InboxList({
  conversations,
  isLoading,
  onSelect,
}: {
  conversations: ConversationWithMeta[];
  isLoading: boolean;
  onSelect: (c: ConversationWithMeta) => void;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-border">
        <InboxIcon size={40} className="mb-4 text-muted-foreground" />
        <h3 className="font-bold font-display text-lg mb-2">No messages yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Start a conversation from a job listing or the applicants list.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {conversations.map((conv) => (
        <button
          key={conv.id}
          data-testid={`conv-row-${conv.id}`}
          onClick={() => onSelect(conv)}
          className="w-full text-left bg-white dark:bg-slate-900 rounded-xl border border-border p-4 hover:border-primary/50 hover:shadow-sm transition-all flex items-start gap-4"
        >
          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
            {conv.otherPartyName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold truncate">{conv.otherPartyName}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {conv.lastMessageAt ? formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: true }) : ""}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <p className="text-sm text-muted-foreground truncate">
                {conv.lastMessage ?? "No messages yet"}
              </p>
              {conv.unreadCount > 0 && (
                <Badge className="bg-primary text-primary-foreground text-xs px-1.5 py-0 min-w-[20px] flex items-center justify-center shrink-0">
                  {conv.unreadCount}
                </Badge>
              )}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default function InboxPage() {
  const { user } = useAuth();
  const [selectedConv, setSelectedConv] = useState<ConversationWithMeta | null>(null);
  const queryClient = useQueryClient();

  const { data: conversations = [], isLoading } = useQuery<ConversationWithMeta[]>({
    queryKey: ["/api/conversations"],
    refetchInterval: 30000,
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get("conv");
    if (convId && conversations.length > 0) {
      const found = conversations.find((c) => c.id === Number(convId));
      if (found) {
        setSelectedConv(found);
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [conversations]);

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <MessageSquare className="text-primary" size={24} />
          <h1 className="text-2xl font-bold font-display">Messages</h1>
        </div>

        {selectedConv ? (
          <ThreadView
            conversation={selectedConv}
            currentUserId={user.id}
            onBack={() => {
              setSelectedConv(null);
              queryClient.invalidateQueries({ queryKey: ["/api/conversations"] });
              queryClient.invalidateQueries({ queryKey: ["/api/conversations/unread-count"] });
            }}
          />
        ) : (
          <InboxList
            conversations={conversations}
            isLoading={isLoading}
            onSelect={(conv) => setSelectedConv(conv)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
