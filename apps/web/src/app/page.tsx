"use client";
import { useState, useRef, useEffect } from "react";
import IntroHero from "./components/IntroHero";
import Header from "./components/Header";
import Hero from "./components/Hero";
import DomainCards from "./components/DomainCards";
import Footer from "./components/Footer";
import gsap from "gsap";
import Lenis from "lenis";

export default function Home() {
  // parent controls whether the main site is visible
  const [mainVisible, setMainVisible] = useState(false);
  const mainWrapperRef = useRef<HTMLDivElement | null>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Initialize Lenis smooth scroll
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      gestureOrientation: "vertical",
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
      infinite: false,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenis.destroy();
    };
  }, []);

  useEffect(() => {
    if (!mainVisible || !mainWrapperRef.current) return;
    gsap.fromTo(
      mainWrapperRef.current,
      { opacity: 0, y: 40, filter: "blur(8px)" },
      { opacity: 1, y: 0, filter: "blur(0px)", duration: 0.9, ease: "power3.out" }
    );
  }, [mainVisible]);

  return (
    <div className="min-h-screen bg-[#03030a]">
      {/* IntroHero will call onStart() when user clicks Get Started, render it only while mainVisible is false so the sticky intro cannot cover the main site */}
      {!mainVisible && <IntroHero onStart={() => setMainVisible(true)} />}

      {/* main site is rendered only when mainVisible is true */}
      <div
        ref={mainWrapperRef}
        aria-hidden={!mainVisible}
        style={{ display: mainVisible ? undefined : "none" }}
      >
        <Header />
        <main>
          <Hero />
          <DomainCards />
        </main>
        <Footer />
      </div>
    </div>
  );
}