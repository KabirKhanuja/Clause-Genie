// apps/web/src/app/upload/page.tsx
import Header from '../components/Header';
import Footer from '../components/Footer';
import UploadCard from '../components/UploadCard';

export default function UploadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a192f] via-[#112240] to-[#0b192e]">
      <Header />
      <main className="px-8 py-16">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-white text-3xl font-bold mb-6">Upload Your Document</h1>
          <p className="text-slate-300 mb-6">
            Upload a PDF, image, or Word doc for Clause Genie to analyse. Session context is ephemeral and processed server-side.
          </p>

          <UploadCard />

          <div className="mt-8 text-sm text-slate-400">
            <strong>Accepted:</strong> .pdf, .png, .jpg, .jpeg, .docx — max size depends on your API config.
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}