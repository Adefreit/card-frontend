import { Link } from "react-router-dom";

const sectionImages = {
  hero: "",
  powers: "",
  game: "",
  starting: "",
  future: "",
  adventure: "",
} as const;

type SectionImageKey = keyof typeof sectionImages;

type SectionVisualProps = {
  imageKey: SectionImageKey;
  alt: string;
  caption: string;
};

function SectionVisual({ imageKey, alt, caption }: SectionVisualProps) {
  const imageSrc = sectionImages[imageKey];

  if (imageSrc) {
    return (
      <figure className="lp-image-figure">
        <img className="lp-image" src={imageSrc} alt={alt} />
        <figcaption>{caption}</figcaption>
      </figure>
    );
  }

  return (
    <div className="lp-image-placeholder" role="img" aria-label={alt}>
      <span>Image Placeholder</span>
      <small>{caption}</small>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="marketing-page lp-page">
      <header className="lp-nav">
        <div className="lp-brand">Legendary Profiles</div>
        <div className="lp-nav-ctas">
          <Link className="lp-nav-link" to="/login">
            Sign in
          </Link>
          <Link className="lp-nav-link" to="/register">
            Start Your Adventure
          </Link>
        </div>
      </header>

      <main className="lp-scroll">
        <section id="hero" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Legendary intro cards</p>
            <h1>Become the hero of your own business card.</h1>
            <p className="lp-tagline">Stand Out. Level Up.</p>
            <p>
              Welcome to Legendary Profiles, where your business card does not
              just introduce you, it summons you. Instead of handing someone a
              plain card, hand them a fantasy-themed profile card that says,
              yes, you are a professional and also awesome.
            </p>
            <p>
              Each card keeps the classic 2.5&quot; x 3.5&quot; format, complete
              with title, subtitle, and flavor text. It is everything people
              love about trading cards, except now you are the legendary
              creature.
            </p>
            <div className="lp-cta-row">
              <Link className="btn-primary btn-lg" to="/register">
                Become a legend
              </Link>
            </div>
          </div>
          <SectionVisual
            imageKey="hero"
            alt="Hero image placeholder"
            caption="Hero artwork or product photo"
          />
        </section>

        <section id="powers" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">A card with powers</p>
            <h2>A business card with actual powers, sort of.</h2>
            <p>
              Every Legendary Profile includes a built-in QR code that works as
              your personal digital portal. Scan it and your contact info can
              pop into someone&apos;s phone with no typing and no awkward name
              spelling moments.
            </p>
            <p>
              If you want to go full wizard mode, a subscription unlocks a
              customizable link hub for your portfolio, socials, calendar,
              booking page, and more.
            </p>
          </div>
          <SectionVisual
            imageKey="powers"
            alt="QR feature image placeholder"
            caption="QR and link-hub feature visual"
          />
        </section>

        <section id="game" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Yes, there is a game</p>
            <h2>But wait. There&apos;s a game.</h2>
            <p>
              Every card includes mysterious symbols and numbers. On their own,
              they look fun. With a Game Pack, they become playable mechanics
              for icebreaker, networking, and party games.
            </p>
            <p>
              Your business card becomes a playable character sheet. Networking
              with bragging rights is absolutely the point.
            </p>
          </div>
          <SectionVisual
            imageKey="game"
            alt="Game pack image placeholder"
            caption="Game pack and symbol examples"
          />
        </section>

        <section id="starting" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Where we are starting</p>
            <h2>Simple, stylish, and already way cooler.</h2>
            <ul className="lp-list">
              <li>A handful of beautifully crafted card designs.</li>
              <li>Printed cards or digital proofs you can print yourself.</li>
              <li>Basic QR code contact-sharing magic.</li>
              <li>One or two games to prove the symbols really work.</li>
            </ul>
          </div>
          <SectionVisual
            imageKey="starting"
            alt="Launch offering image placeholder"
            caption="Starter product lineup preview"
          />
        </section>

        <section id="future" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Where we are going</p>
            <h2>This is just the first chapter.</h2>
            <ul className="lp-list">
              <li>More card designs from elegant to wildly epic.</li>
              <li>Enhanced QR features with analytics and custom pages.</li>
              <li>New Game Packs so card powers grow over time.</li>
              <li>Community features, because heroes deserve a guild.</li>
              <li>Foils, holographics, and plastic cards.</li>
            </ul>
          </div>
          <SectionVisual
            imageKey="future"
            alt="Future roadmap image placeholder"
            caption="Roadmap or teaser visuals"
          />
        </section>

        <section id="adventure" className="lp-section lp-section-end">
          <div className="lp-section-content">
            <p className="lp-kicker">Join the adventure</p>
            <h2>Claim your profile and spark a story.</h2>
            <p>
              If you have ever wanted a business card that people keep, show
              off, and talk about, this is your moment.
            </p>
            <ul className="lp-list">
              <li>Become a legend.</li>
              <li>Claim your profile.</li>
              <li>Let your card do more than sit in a pocket.</li>
            </ul>
            <div className="lp-cta-row">
              <Link className="btn-primary btn-lg" to="/register">
                Start your adventure
              </Link>
              <Link className="btn-ghost btn-lg" to="/login">
                I already have an account
              </Link>
            </div>
          </div>
          <SectionVisual
            imageKey="adventure"
            alt="Final call to action image placeholder"
            caption="Final brand image or showcase card"
          />
        </section>
      </main>
    </div>
  );
}
