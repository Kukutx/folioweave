"use client";

import { motion, useInView } from "framer-motion";
import { Award, TrendingUp } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { mailto, siteConfig } from "@/config/site";

const reveal = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.8,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};
const stagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.1 },
  },
};
const contactVariants = [
  ["contact-btn-default", "Contact Now"],
  ["contact-btn-retro", "CONTACT.EXE"],
  ["contact-btn-neo", "START_MAIL"],
  ["contact-btn-old", "Send Mail..."],
  ["contact-btn-glitch", "C0NTACT_N0W"],
  ["contact-btn-glass", "Connect"],
  ["contact-btn-clay", "Get in Touch"],
] as const;

function CountUp({
  target,
  duration = 2000,
}: {
  target: number;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true, margin: "-100px" });
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!visible) return;
    let started: number | null = null;
    let raf = 0;
    const frame = (time: number) => {
      if (started === null) started = time;
      const progress = Math.min((time - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 4);
      setValue(Math.floor(eased * target));
      if (progress < 1) raf = requestAnimationFrame(frame);
      else setValue(target);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [visible, target, duration]);
  return <span ref={ref}>{value}%</span>;
}

function ProjectBlock({
  title,
  image,
  alt,
  children,
  label,
}: {
  title: string;
  image: string;
  alt: string;
  children: React.ReactNode;
  label?: boolean;
}) {
  return (
    <motion.div
      style={{ marginBottom: "4rem", marginTop: "4rem" }}
      variants={reveal}
    >
      {label && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: ".5rem",
            marginBottom: ".75rem",
            fontSize: ".75rem",
            textTransform: "uppercase",
            letterSpacing: ".1em",
            fontWeight: 500,
            color: "#666",
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#22c55e",
              display: "inline-block",
              animation: "pulse 2s ease-in-out infinite",
            }}
          />
          <span>CURRENTLY WORKING NOW</span>
        </div>
      )}
      <h3
        style={{
          fontSize: "1.25rem",
          fontWeight: 500,
          marginBottom: "1rem",
          color: "#111",
        }}
      >
        {title}
      </h3>
      <img
        src={image}
        alt={alt}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: 8,
          display: "block",
          marginBottom: "1.5rem",
        }}
      />
      {children}
    </motion.div>
  );
}

function Metric({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
      style={{
        marginTop: "3rem",
        marginBottom: "4rem",
        padding: "2rem",
        background: "#fff",
        borderRadius: 16,
        border: "1px solid rgba(0,0,0,.06)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <motion.div
        style={{
          fontSize: "1.5rem",
          fontWeight: 600,
          color: "#111",
          lineHeight: 1.4,
          fontFamily:
            "var(--font-main, -apple-system, BlinkMacSystemFont, sans-serif)",
          display: "flex",
          alignItems: "center",
          gap: ".75rem",
        }}
        initial={{ opacity: 0, x: -20 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, delay: 0.5 }}
      >
        <TrendingUp size={24} style={{ flexShrink: 0 }} />
        {children}
      </motion.div>
    </motion.div>
  );
}

export function DistrictPage() {
  const [contactIndex, setContactIndex] = useState(0);
  useLayoutEffect(() => {
    history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const ids = [0, 50, 200].map((delay) =>
      window.setTimeout(() => window.scrollTo(0, 0), delay),
    );
    return () => ids.forEach(clearTimeout);
  }, []);
  useEffect(() => {
    const id = window.setInterval(
      () => setContactIndex((value) => (value + 1) % contactVariants.length),
      250,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="district-case-study-page">
      <motion.div
        className="case-study-container"
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div
          className="case-study-header"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <div className="case-study-header-center">
            <div className="case-study-badge-container">
              <img
                src="/assets/district-icon-fad26ad7.png"
                alt="District by Zomato"
                className="case-study-badge-icon"
              />
              <div className="award-badge shimmer-badge case-study-badge-above">
                <Award size={14} strokeWidth={2.5} />
                <span>Best App of 2025 - Google Play</span>
              </div>
            </div>
            <h1 className="case-study-title-large">
              Designing the movies experience{" "}
              <span className="highlight-yellow">for millions</span> of people
              in India at <br />
              <span style={{ whiteSpace: "nowrap" }}>District by Zomato</span>
            </h1>
            <p className="case-study-subtitle">
              Crafting movies vertical, facilitating over 75 million ticket
              sales with scalable, user-friendly flows
            </p>
          </div>
        </motion.div>
        <motion.div
          className="case-study-content"
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
        >
          <motion.section className="case-study-main-content" variants={reveal}>
            <motion.p variants={reveal}>
              My approach focuses on understanding user behavior, identifying
              pain points, and iterating on solutions that make the ticket
              booking experience as smooth as possible. From seat selection to
              payment flows, every interaction is carefully crafted to reduce
              friction and increase user confidence.
            </motion.p>
            <motion.p variants={reveal}>
              My designs here represent the intersection of user-centered design
              and business objectives - proving that great design can drive both
              user satisfaction and business growth. Through careful research,
              prototyping, and testing, we&apos;ve built flows that millions of
              users trust for their entertainment needs. It&apos;s a privilege
              to design for the Best App of the Year - Google Play, and this
              recognition validates my commitment to creating exceptional user
              experiences that resonate with millions of users across India.
            </motion.p>
            <motion.h2
              variants={reveal}
              style={{
                marginTop: "4rem",
                marginBottom: "2rem",
                fontSize: "1.5rem",
                fontWeight: 600,
                color: "#111",
              }}
            >
              Here are a few of many projects I worked on
            </motion.h2>
            <ProjectBlock
              title="New Spotlight Cards"
              image="/media/5c0589_85c7ce872fc04e6197af87a91819444e~mv2.webp"
              alt="New Spotlight Cards"
            >
              <p>
                New Spotlight Cards is a brand new way to discover movies in a
                contextual way, but giving users reasons to watch (RTW) and make
                a new way to explore new movies, watch trailers, song releases
                and more. This innovative feature transforms how users interact
                with movie content by presenting curated, contextual information
                that helps them make informed viewing decisions. Instead of just
                showing movie posters and basic details, Spotlight Cards provide
                rich, engaging content that gives users compelling reasons to
                watch - whether it&apos;s an exciting trailer, a trending song
                release, behind-the-scenes content, or personalized
                recommendations based on their viewing history. The design
                creates a more immersive discovery experience that goes beyond
                traditional browsing, making movie exploration feel more like an
                engaging journey rather than a simple search task.
              </p>
            </ProjectBlock>
            <Metric>
              CTR increase by <CountUp target={22} />
            </Metric>
            <ProjectBlock
              title="50 Years of Rajinikanth"
              image="/media/5c0589_7a19e7707f9f47aba23847f56ab6e61a~mv2.webp"
              alt="Thalaivar Tribute"
            >
              <p>
                50 Years of Thalaivar. #Coolie Release. Same Month. So I had an
                idea to celebrate this iconic moment with a small token of love
                and tribute! This project was born from a deep appreciation for
                the legendary actor Rajinikanth and his monumental contribution
                to Indian cinema. I wanted to create something special that
                honors this milestone. It&apos;s a heartfelt celebration of
                cultural impact, a tribute to an icon, and a demonstration of
                how passion can drive creative expression.
              </p>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
                style={{
                  marginTop: "1.5rem",
                  fontSize: "1rem",
                  color: "#666",
                  fontStyle: "italic",
                  lineHeight: 1.6,
                }}
              >
                What started as a fun side project is now generating revenue.
                Sometimes the best ideas come from just following your
                curiosity.
              </motion.p>
            </ProjectBlock>
            <ProjectBlock
              title="Updated Movie Detailed Page"
              image="/media/5c0589_9743a3bf5a364dbdbe1f9713e98529fb~mv2.webp"
              alt="Updated Movie Detailed Page"
            >
              <p>
                I redesigned the movie detailed page, the most important screen
                of the movie vertical with millions of impressions. The
                challenge was to create a more intuitive and engaging experience
                while improving key business metrics. I made offer visibility
                much better by strategically placing promotional cards and
                discounts in prominent positions, ensuring users can easily
                discover and take advantage of special deals. Show
                discoverability was significantly improved through a cleaner
                layout, better information hierarchy, and more intuitive
                navigation patterns that help users find showtimes and theaters
                faster. The redesign also focused on improving content
                presentation, making movie information more scannable and
                actionable. By optimizing the visual hierarchy and reducing
                cognitive load, users can now make booking decisions more
                quickly and confidently.
              </p>
            </ProjectBlock>
            <Metric>
              Offer discoverability has been increased by{" "}
              <CountUp target={18} />
            </Metric>
            <ProjectBlock
              title="Blockbuster Tuesdays"
              image="/media/5c0589_0a59eba495e947ad9ff22c2546a28b04~mv2.webp"
              alt="Blockbuster Tuesdays"
            >
              <p>
                Blockbuster Tuesdays lets you discover the cheapest movie shows
                near you, creating a brand new funnel for the user. All the
                national places have this offer, and at District we make sure
                discovering these shows should be made very easy and delightful.
                I designed an intuitive discovery experience that surfaces
                discounted Tuesday shows prominently, making it effortless for
                users to find the best deals in their area. The feature includes
                smart filtering and location-based recommendations that help
                users quickly identify the most affordable options. By creating
                a dedicated, user-friendly interface for this popular offer,
                we&apos;ve made it easier than ever for movie enthusiasts to
                enjoy their favorite films at discounted prices while driving
                engagement and bookings on Tuesdays.
              </p>
            </ProjectBlock>
            <ProjectBlock
              title="Food at Seat"
              image="/media/5c0589_b7e6559a7cde434e91bb9e69d79cfc0c~mv2.webp"
              alt="Food at Seat"
            >
              <p>
                Food at Seat is a delightful feature where people can scan the
                QR code at the theatre and order food to their seat, or pick up
                from the counter. I designed this seamless ordering experience
                to eliminate the hassle of standing in long queues during movie
                intervals. The feature allows users to browse the menu,
                customize their orders, and choose between convenient seat
                delivery or quick counter pickup. By integrating QR code
                scanning with an intuitive ordering interface, we&apos;ve
                transformed the traditional theatre food experience into a
                modern, contactless, and user-friendly service. This feature not
                only enhances the movie-going experience but also increases food
                sales by making ordering more accessible and convenient for
                moviegoers.
              </p>
            </ProjectBlock>
            <ProjectBlock
              label
              title="Re-imaging Movies Design on District"
              image="/media/5c0589_53e686a3ba004bec88d510dc56cbcdda~mv2.webp"
              alt="Re-imaging Movies Design on District"
            >
              <p>
                I am reimagining the movies vertical from the ground up, and
                instead of just doing a Figma prototype, I am completely
                building the app using SwiftUI. This marks a new way for me to
                design and prototype - moving beyond static mockups to fully
                functional, interactive experiences. My curiosity drives me to
                explore how design decisions translate directly into code,
                understanding the constraints and possibilities of native iOS
                development. By building with SwiftUI, I&apos;m learning how
                animations feel in real-time, how interactions respond to user
                input, and how the design system works at a fundamental level.
                This hands-on approach allows me to iterate faster, test ideas
                more thoroughly, and create designs that are not just beautiful
                but also technically sound and performant. It&apos;s a journey
                of continuous learning, where each line of code teaches me
                something new about the relationship between design and
                engineering.
              </p>
            </ProjectBlock>
            <motion.div
              style={{
                marginTop: "4rem",
                marginBottom: "2rem",
                textAlign: "center",
              }}
              variants={reveal}
            >
              <motion.p
                style={{
                  fontSize: "1.125rem",
                  lineHeight: 1.7,
                  color: "#111",
                  marginBottom: "2rem",
                }}
                variants={reveal}
              >
                And many, many more. Want to know about my experience and
                projects here? Get in touch!
              </motion.p>
              <motion.div
                style={{ display: "flex", justifyContent: "center" }}
                variants={reveal}
              >
                <a
                  href={mailto(siteConfig.contact.email, siteConfig.contact.helloSubject)}
                  className={`contact-btn ${contactVariants[contactIndex][0]}`}
                >
                  {contactVariants[contactIndex][1]}
                </a>
              </motion.div>
            </motion.div>
          </motion.section>
        </motion.div>
      </motion.div>
    </div>
  );
}
