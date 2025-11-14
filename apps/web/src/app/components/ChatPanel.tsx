'use client';
import { useState } from 'react';

type Message = { role: 'user' | 'genie', text: string };

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'genie', text: 'Hi — upload a document and ask me anything about clauses, coverage, or policies.' }
  ]);
  const [input, setInput] = useState('');

  async function send() {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', text: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput('');
    // mock genie response (later replace with API call)
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'genie', text: `Mock response to: "${userMsg.text}"` }]);
    }, 700);
  }

  return (
    <div className="p-6 rounded-2xl bg-[#081226]/50 border border-slate-700">
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto mb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`relative break-words max-w-[75%] px-4 py-3 ${
                m.role === 'user'
                  ? 'bg-gradient-to-r from-slate-700 to-slate-600 text-white border border-slate-600 rounded-tl-2xl rounded-tr-xl rounded-bl-xl rounded-br-2xl shadow-sm'
                  : 'bg-gradient-to-r from-[#13a4ec] to-[#00f2ea] text-black rounded-tl-xl rounded-tr-2xl rounded-bl-2xl rounded-br-xl shadow-md'
              } whitespace-pre-wrap`}
            >
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e)=>setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask Genie about the document..."
          className="flex-1 rounded-full px-4 py-2 bg-[#061026] border border-slate-700 text-slate-200"
        />
        <button onClick={send} className="rounded-full px-4 py-2 bg-gradient-to-r from-[#13a4ec] to-[#00f2ea] text-black font-semibold">Send</button>
      </div>
    </div>
  );
}