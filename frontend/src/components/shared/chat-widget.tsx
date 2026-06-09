"use client";

import { MessageCircle, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, WS_BASE } from "@/lib/api";
import type { ChatMessage, User } from "@/lib/types";
import { useToast } from "./toast";

export function ChatWidget({
  token,
  user,
  studentId,
  label = "Chat",
  variant = "floating",
}: {
  token: string;
  user: User;
  studentId: string;
  label?: string;
  variant?: "floating" | "inline";
}) {
  const [open, setOpen] = useState(variant === "inline");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("offline");
  const [unread, setUnread] = useState(0);
  const openRef = useRef(open);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const { showError, showToast } = useToast();

  useEffect(() => {
    openRef.current = open;
    if (open) setUnread(0);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  useEffect(() => {
    if (!token || !studentId) return;

    api<{ messages: ChatMessage[] }>(
      `/api/chat/${studentId}/messages`,
      {},
      token,
    )
      .then((data) => setMessages(data.messages || []))
      .catch((err) => showError(err, "Could not load chat"));

    const socket = new WebSocket(
      `${WS_BASE}?token=${encodeURIComponent(token)}&studentId=${studentId}`,
    );
    socketRef.current = socket;
    setStatus("connecting");

    socket.onopen = () => setStatus("online");
    socket.onclose = () => setStatus("offline");
    socket.onerror = () => setStatus("offline");
    socket.onmessage = (event) => {
      let message: ChatMessage;
      try {
        message = JSON.parse(event.data) as ChatMessage;
      } catch {
        showToast({
          kind: "error",
          title: "Chat message failed",
          body: "The server sent an invalid chat payload.",
        });
        return;
      }
      setMessages((current) => [...current, message]);
      api(`/api/chat/${studentId}/read`, { method: "PATCH" }, token).catch(
        () => {},
      );
      if (message.senderRole !== user.role && !openRef.current) {
        setUnread((current) => current + 1);
        showToast({
          kind: "info",
          title: "New chat message",
          body: message.message,
        });
      }
    };

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, [studentId, token, user.role, showError, showToast]);

  function send() {
    const socket = socketRef.current;
    if (!text.trim()) return;
    if (socket?.readyState !== WebSocket.OPEN) {
      showToast({
        kind: "error",
        title: "Chat is offline",
        body: "Please wait for the chat connection to come online.",
      });
      return;
    }
    socket.send(JSON.stringify({ message: text.trim() }));
    setText("");
  }

  const chatPanel = (
    <section
      className={`${
        variant === "floating"
          ? "mb-3 w-[min(24rem,calc(100vw-2.5rem))] shadow-xl"
          : "min-h-[32rem] w-full shadow-sm"
      } grid overflow-hidden rounded-lg border border-slate-200 bg-white`}
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{label}</h2>
          <p className="text-xs text-slate-500">{status}</p>
        </div>
        {variant === "floating" && (
          <button
            className="icon-btn"
            onClick={() => setOpen(false)}
            title="Close chat"
            type="button"
          >
            <X size={16} />
          </button>
        )}
      </header>
      <div className="h-72 overflow-auto bg-slate-50 p-3 md:h-96">
        {messages.length === 0 && (
          <p className="text-sm text-slate-500">No messages yet.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-2 flex ${
              msg.senderRole === user.role ? "justify-end" : "justify-start"
            }`}
          >
            <span
              className={`max-w-[78%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                msg.senderRole === user.role
                  ? "bg-slate-950 text-white"
                  : "bg-white text-slate-900"
              }`}
            >
              {msg.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <div className="flex gap-2 border-t border-slate-200 p-3">
        <input
          className="field"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
          placeholder="Type a message"
        />
        <button
          className="icon-btn"
          onClick={send}
          title="Send message"
          type="button"
        >
          <Send size={16} />
        </button>
      </div>
    </section>
  );

  if (variant === "inline") {
    return chatPanel;
  }

  return (
    <div className="fixed right-5 bottom-5 z-50">
      {open && chatPanel}
      <button
        className="relative flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl"
        onClick={() => setOpen((value) => !value)}
        title="Open chat"
        type="button"
      >
        <MessageCircle size={24} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
