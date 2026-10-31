import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import Script from "next/script";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import { CONSENT_DEFAULT_SCRIPT } from "@/components/analytics/ga";
import "./globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.realtravelguides.com"),
  title: {
    default: "Real Travel Guides",
    template: "%s | Real Travel Guides",
  },
  description:
    "Real Travel Guides is a small independent publisher dedicated to helping travelers explore the world independently, sustainably, and with confidence — through rail-based, self-guided travel guides and local expertise.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const gaMeasurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim();

  return (
    <html lang="en">
      <body
        className={`${fraunces.variable} ${inter.variable} font-sans antialiased`}
      >
        {gaMeasurementId ? (
          <Script id="rtg-consent-defaults" strategy="beforeInteractive">
            {CONSENT_DEFAULT_SCRIPT}
          </Script>
        ) : null}
        <Header />
        <main>{children}</main>
        <Footer />
        {gaMeasurementId ? (
          <GoogleAnalytics measurementId={gaMeasurementId} />
        ) : null}
      </body>
    </html>
  );
}
