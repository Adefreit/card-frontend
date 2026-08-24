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
              Your business card shouldn’t just introduce you — it should{" "}
              <i>summon</i> you. Legendary Profiles transforms the classic
              2.5&quot; × 3.5&quot; trading‑card format into a bold,
              unforgettable statement piece. Title, subtitle, flavor text… it’s
              everything people love about collectible cards, except <b>you</b>{" "}
              are the rare pull.
            </p>
            <p>It’s professional.</p>
            <p>It’s fun.</p>
            <p>
              <b>
                It’s the card people will actually keep long after they meet
                you.
              </b>
            </p>
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

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Your New Business Card</p>
            <h2>Familiar format, uniquely yours.</h2>
            <p>Meet your Legendary Profile — isn't it awesome?</p>
            <p>
              Inspired by real collectible card games, each Legendary Profile
              blends <b>professional polish</b> with <b>playful charm</b>. It’s
              instantly recognizable yet unmistakably yours — the kind of card
              that stands out in a stack and sparks conversation the moment it’s
              seen.
            </p>
          </div>
          <SectionVisual
            imageKey="how-it-works"
            alt="Card showcase image placeholder"
          />
        </section>
        <div className="lp-divider">
          <span>✦</span>
        </div>

        {/* POWERS */}
        <section id="powers" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">More Than a Piece of Paper</p>
            <h2>Features that feel magical.</h2>
            <p>
              Every Legendary Profile is packed with features that make it both
              useful and entertaining.
            </p>
            <ul className="lp-list">
              <li>
                <b>Dynamic QR Code.</b> Scan your card and watch a digital
                version of your profile appear like a mini‑summoning spell.
                People can download your contact info or explore your
                personalized link hub.
              </li>
              <li>
                <b>Gamification.</b> Each card includes mysterious symbols and
                numbers. With Game Packs, those symbols transform into playable
                powers for icebreakers, networking quests, and party adventures.
              </li>
            </ul>
            <p>
              Game Packs are an ongoing journey. Free and premium packs will
              roll out regularly, each adding new mechanics that make your card
              more interactive, more valuable, and more fun.
            </p>
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
              Most smart business card companies hide the cool/useful features
              behind paywalls or mandatory subscriptions.
            </p>
            <p>
              <b>Not us.</b>
            </p>
            <p>
              When you purchase a Legendary Profile card, your{" "}
              <b>digital hub</b> is fully accessible and customizable for the
              lifetime of our service — no subscription plans or upsells
              required. Scout's honor.
            </p>
            <p>
              We also want you to have full control over how you print and use
              your cards:
            </p>
            <ul className="lp-list">
              <li>You can always order printed cards through us . . .</li>
              <li>
                <b>OR</b> you can download your print-ready proofs and print
                them yourself. We even provide a ready-to-go Avery template.
              </li>
            </ul>
            <p>
              A subscription is available for members who want free monthly
              digital cards and advanced features, but it's completely optional.
              Buy cards <i>à la carte</i> anytime.
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
            <h2>The world is expanding.</h2>
            <p>
              Legendary Profiles is a passion project — and we're just getting
              started. Upcoming features include:
            </p>
            <ul className="lp-list">
              <li>More card designs from business-formal to wildly epic.</li>
              <li>Enhanced QR features with analytics and custom pages.</li>
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
            <p className="lp-kicker">Join the Adventure</p>
            <h2>Claim your profile and spark a story.</h2>
            <p>
              Your card is the beginning of an adventure — one that grows every
              time you share it. Join the community of professionals who decided
              their business card should be more than a rectangle of paper. It
              should be legendary.
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
