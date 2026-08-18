"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type HeroSlide = {
  src: string;
  alt: string;
  location?: string;
};

export default function HeroCarousel({
  slides,
  intervalMs = 6000,
}: {
  slides: HeroSlide[];
  intervalMs?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [slides.length, intervalMs]);

  return (
    <div className="absolute inset-0">
      {slides.map((slide, i) => (
        <div
          key={slide.src}
          className="absolute inset-0 transition-opacity duration-1000"
          style={{ opacity: i === index ? 1 : 0 }}
          aria-hidden={i !== index}
        >
          <Image
            src={slide.src}
            alt={slide.alt}
            fill
            priority={i === 0}
            className="object-cover"
          />
        </div>
      ))}

      {slides[index]?.location && (
        <div className="absolute right-6 top-6 z-10 rounded-full border border-paper/30 bg-ink/40 px-3 py-1 text-[11px] font-medium uppercase tracking-widest text-paper/90 backdrop-blur-sm md:right-10 md:top-10">
          {slides[index].location}
        </div>
      )}

      {slides.length > 1 && (
        <div className="absolute bottom-6 right-6 z-10 flex gap-2 md:bottom-10 md:right-10">
          {slides.map((slide, i) => (
            <button
              key={slide.src}
              onClick={() => setIndex(i)}
              aria-label={`Show slide ${i + 1}`}
              className="h-1.5 rounded-full transition-all duration-300"
              style={{
                width: i === index ? "20px" : "8px",
                backgroundColor:
                  i === index ? "var(--paper)" : "rgba(246,243,236,0.4)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
