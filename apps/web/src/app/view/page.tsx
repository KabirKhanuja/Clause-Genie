import Header from '../components/Header';
import Footer from '../components/Footer';
import DocumentSummary from '../components/DocumentSummary';

export default function ViewPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <main className="px-8 py-12">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 p-6 rounded-2xl bg-[#081226]/50 border border-slate-700">
            <div className="h-96 bg-[#0b1220] rounded-md flex items-center justify-center text-slate-400">Document viewer / diagram placeholder</div>
          </div>

          <aside className="p-6 rounded-2xl bg-[#081226]/50 border border-slate-700">
            <h3 className="text-white font-bold mb-4">Summary</h3>
            <DocumentSummary />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}