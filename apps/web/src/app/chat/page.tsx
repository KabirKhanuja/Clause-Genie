import Header from '../components/Header';
import Footer from '../components/Footer';
import ChatPanel from '../components/ChatPanel';

export default function ChatPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-8 py-12">
        <div className="max-w-4xl mx-auto">
          <ChatPanel />
        </div>
      </main>
      <Footer />
    </div>
  );
}