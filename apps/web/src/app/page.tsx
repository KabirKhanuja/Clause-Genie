import Header from './components/Header';
import Hero from './components/Hero';
import DomainCards from './components/DomainCards';
import Footer from './components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        
        <div className="max-w-5xl mx-auto px-8">
          <DomainCards />
        </div>
      </main>
      <Footer />
    </div>
  );
}