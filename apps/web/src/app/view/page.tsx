"use client";

import { useSearchParams } from "next/navigation";
import Header from "../components/Header";
import Footer from "../components/Footer";
import SessionDocsList from "../components/SessionDocsList";
import DocumentViewer from "../components/DocumentViewer";
import ChatWindow from "../components/ChatWindow";

export default function ViewPage() {
  const search = useSearchParams();
  const sessionId = search?.get("sessionId") || "";

  return (
    <div className="min-h-screen bg-linear-to-br from-[#061026] via-[#07142a] to-[#020617]">
      <Header />
      <main className="px-6 py-12">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* viewer area */}
          <div className="md:col-span-3 p-6 rounded-2xl bg-[#081226]/50 border border-slate-700">
            <DocumentViewer sessionId={sessionId} />
          </div>

          {/* sidebar */}
          <aside className="p-6 rounded-2xl bg-[#081226]/50 border border-slate-700">
            <h3 className="text-white font-bold mb-4">Session documents</h3>
            <SessionDocsList sessionId={sessionId} />
          </aside>
        </div>
      </main>
      <Footer />

      {/* slide-in chat panel */}
      <ChatWindow sessionId={sessionId} />
    </div>
  );
}