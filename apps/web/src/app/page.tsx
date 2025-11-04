import IntroHero from './components/IntroHero';
import Header from './components/Header';
import Hero from './components/Hero';
import DomainCards from './components/DomainCards';
import Footer from './components/Footer';

export default function Home() {
  return (
    <div className="min-h-screen bg-[#03030a]">
      <IntroHero />
      <Header />
      <main>
        <Hero />
        <DomainCards />
      </main>
      <Footer />
    </div>
  );
}