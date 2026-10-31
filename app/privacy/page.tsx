import type { Metadata } from "next";

const PRIVACY_TITLE = "Privacy & Cookies | Real Travel Guides";
const PRIVACY_DESCRIPTION =
  "How Real Travel Guides handles newsletter sign-ups, optional Google Analytics, cookies, and your rights under UK data protection law.";

export const metadata: Metadata = {
  title: {
    absolute: PRIVACY_TITLE,
  },
  description: PRIVACY_DESCRIPTION,
  alternates: { canonical: "/privacy" },
  openGraph: {
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    url: "/privacy",
    type: "website",
    images: [
      {
        url: "/images/real-travel-guides-social.jpg",
        width: 1024,
        height: 537,
        type: "image/jpeg",
        alt: "Real Travel Guides – independent rail travel across Europe",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: PRIVACY_TITLE,
    description: PRIVACY_DESCRIPTION,
    images: [
      {
        url: "/images/real-travel-guides-social.jpg",
        width: 1024,
        height: 537,
        type: "image/jpeg",
        alt: "Real Travel Guides – independent rail travel across Europe",
      },
    ],
  },
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <article className="max-w-2xl">
        <p className="eyebrow text-clay-dark">Your information</p>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-pine md:text-4xl">
          Privacy and cookies
        </h1>
        <p className="mt-6 text-sm leading-relaxed text-stone">
          Real Travel Guides is an independent travel publishing business
          founded and operated by Carolyn Storme, who is responsible for the
          personal information collected through this website.
        </p>
        <p className="mt-4 text-sm leading-relaxed text-stone">
          Last updated: 31 October 2026.
        </p>

        <h2 className="mt-10 font-display text-2xl font-semibold text-pine">
          Contacting us
        </h2>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-stone">
          <p>
            Email{" "}
            <a
              href="mailto:realtravelguides@gmail.com"
              className="text-moss underline underline-offset-2"
            >
              realtravelguides@gmail.com
            </a>{" "}
            with any question about your information.
          </p>
          <p>
            If you contact us by email, we will use the information you provide
            to respond to your enquiry. We do not add your email address to
            our mailing list unless you have subscribed separately. We process
            enquiries on the basis of our legitimate interests in responding
            to correspondence.
          </p>
        </div>

        <h2 className="mt-10 font-display text-2xl font-semibold text-pine">
          Email subscriptions
        </h2>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-stone">
          <p>
            If you subscribe to receive updates from Real Travel Guides, we
            will use your email address to send you travel inspiration,
            practical advice, news and occasional information about our travel
            guides.
          </p>
          <p>
            We use your email address for these communications with your
            consent. You can unsubscribe at any time using the link in our
            emails or by contacting us at{" "}
            <a
              href="mailto:realtravelguides@gmail.com"
              className="text-moss underline underline-offset-2"
            >
              realtravelguides@gmail.com
            </a>.
          </p>
          <p>
            We keep your email address until you unsubscribe or ask us to
            delete it, unless we are legally required to retain it.
          </p>
          <p>
            We do not sell or share our subscriber mailing list with third
            parties for their own marketing purposes.
          </p>
        </div>

        <h2 className="mt-10 font-display text-2xl font-semibold text-pine">
          Analytics and cookies
        </h2>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-stone">
          <p>
            We use Google Analytics to understand how visitors use our
            website. Analytics is optional and only runs after you accept. We
            use it on the basis of your consent.
          </p>
          <p>
            It helps us understand page visits, clicks on links to our guides,
            and newsletter subscriptions. No email addresses are sent to
            Google Analytics.
          </p>
          <p>
            A cookie remembers your preference for one year. If you accept,
            Google Analytics also uses cookies. You can change or withdraw
            your consent at any time through Cookie settings in the footer.
          </p>
          <p>
            We do not use advertising cookies. Google Analytics is a
            third-party service and may process this information outside the
            UK.
          </p>
        </div>

        <h2 className="mt-10 font-display text-2xl font-semibold text-pine">
          Service providers
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone">
          Trusted service providers help us operate this website. They may
          process personal information outside the UK.
        </p>

        <h2 className="mt-10 font-display text-2xl font-semibold text-pine">
          External websites
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-stone">
          This website links to Amazon, other travel-related websites, and our
          social media pages. Those sites have their own privacy policies. We
          do not control those sites.
        </p>

        <h2 className="mt-10 font-display text-2xl font-semibold text-pine">
          Your rights
        </h2>
        <div className="mt-3 space-y-4 text-sm leading-relaxed text-stone">
          <p>Under UK GDPR, you have the right to:</p>
          <ul className="space-y-2">
            <li className="route-line">
              Access the personal information we hold about you.
            </li>
            <li className="route-line">Correct it if it is wrong.</li>
            <li className="route-line">Have it deleted.</li>
            <li className="route-line">Restrict how we use it.</li>
            <li className="route-line">
              Receive it in a portable form, where applicable.
            </li>
            <li className="route-line">Object to our use of it.</li>
            <li className="route-line">
              Withdraw your consent, where we rely on consent.
            </li>
          </ul>
          <p>
            Contact{" "}
            <a
              href="mailto:realtravelguides@gmail.com"
              className="text-moss underline underline-offset-2"
            >
              realtravelguides@gmail.com
            </a>{" "}
            to exercise these rights. You can also complain to the Information
            Commissioner&apos;s Office at{" "}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-moss underline underline-offset-2"
            >
              ico.org.uk
            </a>.
          </p>
          <p>We do not sell personal information.</p>
        </div>
      </article>
    </div>
  );
}
