import { Link } from "react-router-dom";

const sectionImages = {
  hero: "",
  "how-it-works": "",
  powers: "",
  game: "",
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
        <section id="hero" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">Create, Collect, Compete</p>
            <h1>Become the hero of your own legends.</h1>
            <p>
              Welcome to Legendary Profiles, where your business card does not
              just introduce you, it <i>summons</i> you. Instead of handing
              someone a plain card, hand them a stylish profile card that says,
              "I'm Professional, but I also know how to have fun."
            </p>
            <p>
              Each card keeps the classic 2.5&quot; x 3.5&quot; format of
              playing cards, complete with title, subtitle, and flavor text. It
              is everything people love about trading cards, except now you are
              the rare collectable.
            </p>
            <div className="lp-cta-row">
              <Link className="btn-primary btn-lg" to="/register">
                Become A Legend
              </Link>
            </div>
          </div>
          <SectionVisual
            imageKey="hero"
            alt="Hero image placeholder"
            caption="Hero artwork or product photo"
          />
        </section>

        <section id="how-it-works" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">How it Works</p>
            <h2>Draft it. Mint it. Make it real.</h2>
            <p>
              Legendary Profiles is built around a simple idea: your card should
              feel magical, but the process should feel easy. Here&apos;s how it
              works::
            </p>
            <p>
              Draft your card for free. Create as many designs as you want and
              experiment with titles, portraits, colors, and flavor text until
              it feels right. When you’re ready to lock it in, mint the card to
              unlock its features and share it with the world!
            </p>
          </div>
          <SectionVisual
            imageKey="how-it-works"
            alt="QR feature image placeholder"
            caption="QR and link-hub feature visual"
          />
        </section>

        <section id="powers" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">A card with powers</p>
            <h2>A business card with actual powers, sort of.</h2>
            <p>
              Every Legendary Profile card includes a built-in QR code that
              works as your personal digital portal. Scan it and your contact
              info can pop into someone&apos;s phone with no typing. You also
              get a custom page to distribute links to your portfolio, socials,
              calendar, or anything else you want to show off.
            </p>
            <p>
              If you want to go full wizard mode, a subscription unlocks
              additional features like analytics and custom designs (coming
              soon!).
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
            <p className="lp-kicker">It's Also a Game</p>
            <h2>But wait. There&apos;s a game.</h2>
            <p>
              Every card includes mysterious symbols and numbers. On their own,
              they look fun. With Game Packs, they transform into playable
              characters for icebreaker, networking, and party games.
            </p>
            <p>
              We view Game Packs as an ongoing adventure. We plan on releasing
              both free and paid games regularly, and each pack will introduce
              new mechanics and ways to play that make every card potentially
              valuable.
            </p>
          </div>
          <SectionVisual
            imageKey="game"
            alt="Game pack image placeholder"
            caption="Game pack and symbol examples"
          />
        </section>

        <section id="future" className="lp-section">
          <div className="lp-section-content">
            <p className="lp-kicker">This is Just the Beginning</p>
            <h2>This is just the first chapter.</h2>
            <p>
              Over the coming months, we will be adding new features, such as:
            </p>
            <ul className="lp-list">
              <li>More card designs from business formal to wildly epic.</li>
              <li>Enhanced QR features with analytics and custom pages.</li>
              <li>New Game Packs so card powers grow over time.</li>
              <li>
                Experience points for your cards so that they can level up and
                gain rarity.
              </li>
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
            caption="Final brand image or showcase card"
          />
        </section>
      </main>
    </div>
  );
}
