import type { Metadata } from "next";
import TravelExperts from "@/components/TravelExperts";

export const metadata: Metadata = {
  title: {
    absolute: "About Real Travel Guides | Independent Rail Travel Experts",
  },
  description:
    "Meet the people behind Real Travel Guides and discover why we create practical, locally informed guides for independent rail travel across Europe.",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-6 py-16 md:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow text-clay-dark">The story behind the guides</p>
          <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-pine md:text-4xl">
            Why I Created Real Travel Guides
          </h1>
          <div className="mt-6 space-y-4 text-sm leading-relaxed text-stone">
            <p>
              After a career in international media and travel publishing, I
              wanted to turn a lifelong passion for independent travel into
              something that could help other people experience Europe
              differently.
            </p>
            <p>
              I was struck by how many travellers still felt they had to choose
              between an organised tour and the complexity of planning an
              independent trip themselves. Yet Europe’s rail networks make it
              easier than ever to explore great cities, smaller towns and places
              beyond the usual tourist trail — without the restrictions of a
              tour or the stress and expense of hiring a car.
            </p>
            <p>
              That was the idea behind Real Travel Guides: to take the hard
              work out of planning while leaving travellers firmly in control.
              Our guides bring together carefully planned routes, practical
              detail and local expertise to help you decide where to go, how
              long to stay and what’s realistically possible — while giving you
              the freedom to shape the journey around your own interests.
            </p>
            <p>
              Our guides are designed first and foremost as practical travel
              companions. We focus on the detail that helps turn an idea into a
              journey: how to build a great itinerary, where to base yourself,
              how places connect, which journeys and detours are worth making,
              and how to explore beyond the obvious. Every page is there to
              help you plan or travel with confidence, supported by local
              expertise and first-hand knowledge. Rail is at the heart of it,
              complemented by boats, buses, cycling and walking where they help
              you discover more.
            </p>
            <p>
              The idea is simple:{" "}
              <span className="font-display text-base italic text-pine">
                We do the planning, so you can concentrate on the travelling.
              </span>
            </p>
          </div>
          <p className="mt-8 font-display text-lg font-semibold text-pine">
            Carolyn Storme
          </p>
          <p className="mt-1 text-sm text-stone">Publisher, Real Travel Guides</p>
        </div>
      </section>

      <TravelExperts />
    </div>
  );
}
