import { Link } from "react-router-dom";

const sectionImages = {
  hero: "hero.jpg",
  "how-it-works": "howitworks.jpg",
  powers: "powers.jpg",
  game: "game.jpg",
  future: "future.jpg",
  adventure: "adventure.jpg",
} as const;

type SectionImageKey = keyof typeof sectionImages;

type SectionVisualProps = {
  imageKey: SectionImageKey;
  alt: string;
};

function SectionVisual({ imageKey, alt }: SectionVisualProps) {
  const imageSrc = sectionImages[imageKey];

  if (imageSrc) {
    return (
      <figure className="lp-image-figure">
        <img className="lp-image" src={imageSrc} alt={alt} />
      </figure>
    );
  }

  return (
    <div className="lp-image-placeholder" role="img" aria-label={alt}>
      <span>Image Placeholder</span>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="marketing-page lp-page">
      <header className="lp-nav">
        <div className="lp-brand">
          <span className="lp-brand-mark" aria-hidden="true">
            <img className="lp-brand-mark__image" src="/favicon.png" alt="" />
          </span>
          <span>Legendary Profiles</span>
        </div>
        <div className="lp-nav-ctas">
          <Link className="lp-nav-link" to="/login">
            Sign in
          </Link>
          <Link className="lp-nav-link" to="/register">
            Register
          </Link>
        </div>
      </header>

      <main className="lp-scroll">
        {/* HERO */}
        <section id="hero" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Create, Collect, Connect</p>
            <h1>Become the hero of your own legends.</h1>
            <p>
              Your card shouldn't just introduce you — it should <i>summon</i>{" "}
              you. Legendary Profiles transforms the classic 2.5&quot; ×
              3.5&quot; trading-card format into a bold, unforgettable statement
              piece. It's everything people love about collectible cards, except{" "}
              <b>you</b> are the rare pull.
            </p>
            <ul className="lp-list">
              <li>It's professional.</li>
              <li>It's fun.</li>
              <li>
                <b>It's a card people will actually keep.</b>
              </li>
            </ul>
            <div className="lp-cta-row">
              <Link className="btn-primary btn-lg" to="/register">
                Become A Legend
              </Link>
            </div>
          </div>
          <SectionVisual imageKey="hero" alt="Hero image placeholder" />
        </section>
        <div className="lp-divider">
          <span>✦</span>
        </div>

        {/* POWERS */}
        <section id="powers" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">More Than a Business Card</p>
            <h2>Features that feel magical.</h2>
            <p>
              Every Legendary Profile is packed with features that make it both
              useful and entertaining.
            </p>
            <ul className="lp-list">
              <li>
                <b>Dynamic QR Code.</b> Scan your card with your phone and watch
                a digital version of your profile appear like a mini-summoning
                spell (try it out!). People can download your contact info on
                their phone or flip the card to see your personalized links
                page.
              </li>
              <li>
                <b>Link Hub.</b> Every legendary profile comes with a
                customizable page where you can share your social media,
                portfolio, and any other links.
              </li>
              <li>
                <b>Digital Card.</b> Out of physical cards? By creating a
                shortcut on your phone, you can share your digital card anytime,
                anywhere, just by tapping an icon and letting someone scan your
                screen.
              </li>
              <li>
                <b>Gamification.</b> Best of all, each card includes mysterious
                symbols and numbers that transform into playable powers for
                icebreakers, networking quests, and party adventures. We will
                offer both free and paid versions of games (coming soon).
              </li>
            </ul>
          </div>
          <SectionVisual imageKey="powers" alt="QR feature image placeholder" />
        </section>
        <div className="lp-divider">
          <span>✦</span>
        </div>

        {/* GAME / BUDGET */}
        <section id="game" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Budget Friendly</p>
            <h2>No nickel-and-diming.</h2>
            <p>
              Most companies hide the cool/useful features of their product
              behind paywalls or mandatory subscriptions.
            </p>
            <p>
              <b>Not us.</b>
            </p>
            <p>
              When you purchase a Legendary Profile, your <b>digital card</b> is
              fully accessible and customizable for the lifetime of our service
              — no subscription plans or upsells required.
            </p>
            <p>
              We also want you to have full control over how you print and use
              your cards:
            </p>
            <ul className="lp-list">
              <li>You can order printed cards through us . . .</li>
              <li>
                <b>OR</b> you can download your proofs and print them yourself.
                We even provide a ready-to-go Avery template to make it easy.
              </li>
            </ul>
            <p>
              A subscription is available for members who want to create
              free/discounted cards every month or access our more
              business-oriented features, but it's completely optional. Buy
              cards <i>à la carte</i> anytime.
            </p>
          </div>
          <SectionVisual
            imageKey="game"
            alt="Budget friendly image placeholder"
          />
        </section>
        <div className="lp-divider">
          <span>✦</span>
        </div>

        {/* FUTURE */}
        <section id="future" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">The Adventure Continues</p>
            <h2>We're just getting started.</h2>
            <p>
              Legendary Profiles is a passion project — and we plan on rolling
              out new features regularly. Upcoming features include:
            </p>
            <ul className="lp-list">
              <li>More card designs from business-formal to wildly epic.</li>
              <li>Enhanced QR features with analytics and custom pages.</li>
              <li>Animated digital cards.</li>
              <li>New Game Packs with evolving mechanics.</li>
              <li>
                Experience points and leveling systems for rarity progression.
              </li>
            </ul>
          </div>
          <SectionVisual
            imageKey="future"
            alt="Future roadmap image placeholder"
          />
        </section>
        <div className="lp-divider">
          <span>✦</span>
        </div>

        {/* FINAL CTA */}
        <section id="adventure" className="lp-section lp-section-end">
          <div className="lp-section-content">
            <p className="lp-kicker">Claim Your Profile</p>
            <h2>What will you create?</h2>
            <p>
              Your business card is more than just contact information — it's a
              reflection of your professional journey and personality. Join our
              community of passionate professionals and make your next card
              truly legendary.
            </p>
            <div className="lp-cta-row">
              <Link className="btn-primary btn-lg" to="/register">
                Create a Free Account
              </Link>
              <Link className="btn-ghost btn-lg" to="/login">
                I Already Have an Account
              </Link>
            </div>
          </div>
          <SectionVisual
            imageKey="adventure"
            alt="Final call to action image placeholder"
          />
        </section>
      </main>
    </div>
  );
}
