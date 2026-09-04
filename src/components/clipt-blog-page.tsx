"use client";

import Link from "next/link";
import { AnimatePresence, motion, useScroll, useSpring } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Code2,
  Database,
  Info,
  Link as LinkIcon,
  MousePointer2,
  Share2,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  ReferenceBabyIcon,
  ReferenceCalendarIcon,
  ReferenceClockIcon,
  ReferenceCpuIcon,
  ReferenceLayersIcon,
  ReferencePaletteIcon,
  ReferenceSparklesIcon,
  ReferenceZapIcon,
} from "./reference-icons";
import { siteCopyright } from "@/config/site";

type Perspective = "standard" | "designer" | "eli5";

const perspectives: Record<
  Perspective,
  { id: Perspective; label: string; content: string }
> = {
  standard: {
    id: "standard",
    label: "The Story",
    content:
      "Building Clipt was an obsession with detail. I did not want to create just another clipboard manager that sits in a list. I wanted to build something that felt like a native part of the OS, something that would make people wonder if Apple had finally built a clipboard manager into a future version of iOS.",
  },
  designer: {
    id: "designer",
    label: "For Designers",
    content:
      "This isn't just about code; it's about context-awareness. Think of the Keyboard as a 'Contextual Agent' that is only summoned when the user intends to create. By making the keyboard the primary data-ingestion point, we remove the friction of jumping between apps.",
  },
  eli5: {
    id: "eli5",
    label: "Explain Like I'm Five",
    content:
      "Imagine your phone has many tiny rooms that can't talk to each other. One room is where you type (the Keyboard), and another is where you see your saved notes (the App). Usually, they are locked. Clipt builds a 'Magic Locker' in the hallway that both rooms can open.",
  },
};

function StandardContent() {
  return (
    <>
      <h2>
        <ReferenceCpuIcon className="content-icon" /> My Tech Stack
      </h2>
      <p>
        I chose tools that allowed for the highest level of performance and the
        cleanest code.
      </p>
      <ul>
        <li>
          <strong>
            <Code2 size={18} className="content-icon" /> Swift and SwiftUI:
          </strong> Everything is built with 100% SwiftUI. I did not use any UIKit for the
          interface unless it was absolutely necessary for low level components
          like the keyboard extension controller. SwiftUI allowed me to iterate
          on the &quot;iOS 26&quot; aesthetic with rapid feedback.
        </li>
        <li>
          <strong>
            <Database size={18} className="content-icon" /> SwiftData and
            CloudKit:
          </strong> This was a major technical decision. I moved away from the old Core
          Data patterns to use SwiftData. I set up a shared model container
          using an App Group (group.com.clipt.shared). This means the moment I
          copy something on my iPhone, it syncs to my Mac via CloudKit, and it
          is immediately available in my Keyboard Extension.
        </li>
        <li>
          <strong>
            <Share2 size={18} className="content-icon" /> Inter Process
            Communication (IPC):
          </strong> Since the Keyboard Extension and the Main App are separate processes,
          they cannot talk to each other directly. I implemented a system using
          Darwin Notifications. When I add an item from the keyboard, I
          broadcast a notification that the main app picks up to refresh its
          view instantly.
        </li>
        <li>
          <strong>
            <LinkIcon size={18} className="content-icon" /> Link Previews:
          </strong> I used LPMetadataProvider to make links look premium. Instead of just
          a URL, I fetch the site title, icon, and a rich preview image.
        </li>
      </ul>
      <h2>
        <AlertCircle className="content-icon" /> Going Deep: The Challenges I
        Faced
      </h2>
      <p>
        Building this was not a straight line. I ran into roadblocks that forced
        me to rethink the entire architecture.
      </p>
      <h3>The Background Copy Nightmare</h3>
      <p>
        I initially thought I could monitor the clipboard in the background
        24/7. I even tried using a background &quot;Audio&quot; mode to keep the
        app alive. This was a classic mistake. I realized quickly that Apple
        would reject the app for misusing background modes. I had to pivot to a
        model where the app is extremely efficient when it is active, and the
        Keyboard Extension takes over the heavy lifting of pasting and
        organizing without needing the main app open.
      </p>
      <h3>Schema Mismatches</h3>
      <p>
        In the early days, I would change the Item model in the app but forget
        to update the Keyboard Extension. This would cause the shared database
        to crash because two different versions of the schema were trying to
        write to the same file. I solved this by strictly centralizing the data
        models into a shared source file that both targets must use.
      </p>
      <h2>
        <ReferenceZapIcon className="content-icon" /> The Technical Heart: Locker, Megaphone,
        and Immortal Sync
      </h2>
      <p>
        The most challenging part of engineering Clipt was managing the
        interaction between the Main App and the Keyboard. On iOS, these are two
        entirely separate processes. They do not share memory and they cannot
        send messages to each other directly. To bridge this gap, I built an
        invisible bridge using two indirect communication methods: a{" "}
        <strong>Shared Locker</strong> and a <strong>System Megaphone</strong>.
      </p>
      <h3>The Shared Locker (The Data Layer)</h3>
      <p>
        I used a Shared App Group to create a dedicated space on the
        iPhone&apos;s storage that both the Main App and the Keyboard can
        access. This is the shared locker. When you copy something, the
        processes do not &quot;send&quot; messages to each other. They simply
        write a new item into the SwiftData store located in this locker.
      </p>
      <p>
        <strong>The WhatsApp Example:</strong> Imagine you are in a WhatsApp
        chat and someone sends you an address. You copy that text. At this
        moment, the Clipt App is &quot;blind&quot;—it’s in the background and
        iOS blocks it from seeing your clipboard. However, the moment you tap
        the message box to reply, the Clipt Keyboard wakes up. Because the
        keyboard is active on your screen, it has &quot;Eyes.&quot; It sees the
        address you just copied, saves it into the Shared Locker, and it&apos;s
        now permanently recorded, even if the main app is completely closed.
      </p>
      <div className="blog-diagram-container">
        <img
          src="/assets/clipt_data_architecture-53b0ab3d.webp"
          alt="Clipt Data Architecture"
          className="blog-diagram"
        />
        <p className="diagram-caption">
          Architecture: Shared SwiftData container via App Groups.
        </p>
      </div>
      <p>
        Because both processes have their own direct key to this locker, the
        system is <strong>immortal</strong>. If you swipe the Main App away from
        your Recents, the Keyboard process remains alive. It continues to
        monitor your clipboard and write new clips into the locker. When you
        eventually decide to open the app again, it simply checks the locker and
        displays everything the Keyboard saved while the app was away.
      </p>
      <h3>The System Megaphone (The Signaling Layer)</h3>
      <p>
        Saving data to a locker is only half the battle. The Main App needs to
        know the exact millisecond the Keyboard has added something new so it
        can refresh its view. Since the App cannot watch the Keyboard directly,
        I used <strong>Darwin Notifications</strong>. This is a system-wide
        megaphone.
      </p>
      <div className="blog-diagram-container">
        <img
          src="/assets/clipt_sync_diagram-61ccf62c.webp"
          alt="Clipt Sync Architecture"
          className="blog-diagram"
        />
        <p className="diagram-caption">
          Process Sync: Darwin Notifications bridging the App and Extension.
        </p>
      </div>
      <p>
        When the Keyboard saves a clip, it shouts a notification (
        <code>com.clipt.dataChanged</code>) across the entire phone kernel:
      </p>
      <pre>
        <code>{`// In KeyboardViewController.swift
let center = CFNotificationCenterGetDarwinNotifyCenter()
let name = CFNotificationName("com.clipt.dataChanged" as CFString)
CFNotificationCenterPostNotification(center, name, nil, nil, true)`}</code>
      </pre>
      <p>
        If the App is open, it hears this shout, immediately opens the locker,
        and refreshes the list using a reactive SwiftData query. This happens so
        fast that it feels like the item teleported from one app to the other.
      </p>
      <h3>Asymmetric Synchrony</h3>
      <p>
        I built the App and the Keyboard with different rhythms to balance speed
        with battery efficiency.
      </p>
      <ul>
        <li>
          <strong>The Keyboard is Paranoid:</strong> It only lives for the few
          seconds you are actually typing, so it pulses every 0.5 seconds. It
          also runs a high-speed check the literal millisecond it starts to
          slide up. This ensures that even if you just copied something in
          Safari, it is already rendered at the top of the history before the
          keyboard is fully visible.
        </li>
        <li>
          <strong>The App is Passive:</strong> It stays in memory much longer
          and wants to save your battery. It pulses every 2.0 seconds. It
          doesn&apos;t need to be faster because it knows if anything urgent
          happens, the Keyboard will use the megaphone to wake it up.
        </li>
      </ul>
      <pre>
        <code>{`// Example of the Keyboard's 0.5s Monitor
private func startClipboardMonitoring() {
    clipboardTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { _ in
        checkForClipboardChanges()
    }
}`}</code>
      </pre>
      <h3>The &quot;Deep Sleep&quot; Scenario (Catch-Up Logic)</h3>
      <p>
        Imagine a scenario where everything is closed: you’ve swiped the Clipt
        App away from Recents, and you haven&apos;t opened your keyboard in any
        app for hours. You are in Safari and you copy a long URL. At this
        moment, both the App and the Keyboard are &quot;dead&quot; in memory.
        Neither of them saw you copy the URL.
      </p>
      <p>
        However, the moment you decide to interact with either one, the{" "}
        <strong>Catch-Up Logic</strong> kicks in instantly:
      </p>
      <ul>
        <li>
          <strong>Opening the Keyboard:</strong> The second you tap a text box
          to type, the Keyboard wakes up. Its first instruction isn&apos;t to
          look at the history; it&apos;s to look at the system clipboard. It
          sees the Safari URL, saves it to the Shared Locker, and displays it at
          the top of the list before the &quot;slide-up&quot; animation even
          finishes.
        </li>
        <li>
          <strong>Opening the App:</strong> Instead of using the keyboard, you
          tap the Clipt icon on your home screen. The App gets its
          &quot;Eyes&quot; back the millisecond it appears. It immediately grabs
          the Safari URL from the system clipboard, saves it to the shared
          locker, and refreshes the list.
        </li>
      </ul>
      <h3>The Universal &quot;Ears&quot; (App Closed Sync)</h3>
      <p>
        The reason Clipt feels flawless even when the app is closed and the
        keyboard is not in use is because of the <strong>Global Sync architecture</strong>. By leveraging Silent Push
        Notifications through CloudKit, the app gains &quot;ears&quot; even when
        it is &quot;blind.&quot;
      </p>
      <p>
        When you copy something on your Mac, iCloud sends a silent signal to
        your iPhone. iOS wakes up a tiny sliver of the Clipt app in the
        background for a 2-second window. In that brief moment of life, the app
        performs a Background Fetch, checks the clipboard, and saves the item
        into the Shared Locker. This happens entirely behind the scenes,
        ensuring that the data is waiting for you before you even unlock your
        phone.
      </p>
      <h3>Intelligence at the Edge</h3>
      <p>
        The Keyboard handles the heavy lifting of data recognition. It runs a <strong>Heuristic Engine</strong> that categorizes every clip. If it
        sees a hex code, it renders a physical color swatch. If it sees a
        password, it flags it as sensitive. Privacy is paramount in the keyboard
        because it is often visible to bystanders. I engineered it to show
        sensitive items as &quot;Locked&quot; rows. To reveal the content, you
        must tap the item and authenticate with FaceID in the Main App. This
        ensures your private data stays private even in a crowded room.
      </p>
      <p>
        By decentralizing the intelligence and using this locker and megaphone
        architecture, I ensured that Clipt feels like a single, zero-latency
        organism, regardless of which process is active or whether the main app
        is closed.
      </p>
      <h2>
        <ReferenceSparklesIcon className="content-icon" /> The Right Moves I Made
      </h2>
      <h3>Haptics as a Language</h3>
      <p>
        I did not just add vibration; I added a haptic language. Every time a
        user copies something, there is a specific light &quot;tap.&quot; When a
        folder is created, it is a &quot;success&quot; haptic. This makes the
        app feel like a physical tool.
      </p>
      <h3>Sensitive Data Detection</h3>
      <p>
        I built a regex based detector. If the app sees something that looks
        like an OTP, a credit card number, or a password, it automatically marks
        it as sensitive. The UI then blurs it out until the user taps to reveal
        it. This was a &quot;right&quot; move for user privacy.
      </p>
      <h3>The &quot;Keyboard First&quot; Mentality</h3>
      <p>
        I stopped thinking of the keyboard as an &quot;add-on&quot; and started
        treating it as the main entrance to the app. Most people use Clipt from
        within other apps, so I made the keyboard UX as powerful as the main
        app, including folder selection and pinned items.
      </p>
      <h2>
        <ReferenceLayersIcon className="content-icon" /> The Evolution: Key Changes
      </h2>
      <ul>
        <li>
          <strong>From List to Sheets:</strong> I moved away from standard lists
          to a &quot;stacked sheet&quot; UI. This keeps the user in context and
          makes the app feel like it is sliding in over the current task.
        </li>
        <li>
          <strong>Unified Device Source:</strong> I added logic to identify
          where a clip came from. Whether it is a &quot;MacBook,&quot;
          &quot;iPad,&quot; or &quot;iPhone,&quot; the app shows the
          corresponding icon. This helps users track their &quot;Clip Flow&quot;
          across their entire Apple ecosystem.
        </li>
      </ul>
      <p>
        I built Clipt to be the tool I always wanted. It was always about
        solving the problem of not having a clipboard history on iOS, while
        making it look beautiful. Every challenge I hit forced me to make the
        app more stable and more private, and that is why it feels as solid as
        it does today.
      </p>
    </>
  );
}

function Eli5Content() {
  return (
    <>
      <h2>How It Works (Simply Put)</h2>
      <p>
        Building an app like Clipt is like building two different houses that
        share a single mailbox.
      </p>
      <h3>The Magic Locker</h3>
      <p>
        Imagine your phone has two separate people living inside it:{" "}
        <strong>Mr. Keyboard</strong> (who writes things) and{" "}
        <strong>Ms. App</strong> (who organizes things). Usually, they live in
        separate rooms and can&apos;t talk to each other.
      </p>
      <p>
        To solve this, I built a <strong>Magic Locker</strong> in the hallway.
      </p>
      <ul>
        <li>
          When you copy something, Mr. Keyboard writes it on a note and puts it
          in the locker.
        </li>
        <li>Ms. App checks the locker and sees the new note instantly.</li>
      </ul>
      <p>
        This way, no matter which room you are in, your notes are always safe in
        the shared locker.
      </p>
      <h3>The Secret Bell</h3>
      <p>
        Putting a note in a locker isn&apos;t enough; the other person needs to
        know it&apos;s there! So, I installed a <strong>Secret Bell</strong>.
      </p>
      <p>
        When Mr. Keyboard drops a note, he rings the bell. Ms. App hears it
        instantly, opens the locker, and grabs the note. This happens so fast
        that it feels like magic.
      </p>
      <h3>Privacy First</h3>
      <p>
        Because Mr. Keyboard is typing sensitive things (like passwords), I
        taught him how to keep secrets. If he sees a password, he puts it in a
        special &quot;Locked Box&quot; inside the locker. Only you can open this
        box using FaceID. This keeps your secrets safe from prying eyes.
      </p>
    </>
  );
}

function DesignerContent() {
  return (
    <>
      <h2>
        <ShieldCheck className="content-icon" /> Designing for Trust
      </h2>
      <h3>
        <Info size={20} className="content-icon" /> Onboarding Trust
      </h3>
      <p>
        Security is paramount, but it is invisible. To make users feel safe, I
        added explicit explanations during the onboarding flow. I used simple,
        reassuring language and clear visuals to explain exactly how their data
        is locked and that we literally cannot see it.
      </p>
      <div className="blog-image-grid-2">
        <img
          src="/assets/clipt_onboarding_security_1-217c9416.webp"
          alt="Clipt Security Onboarding Screen 1"
          style={{ borderRadius: 24, border: "1px solid rgba(0,0,0,.1)" }}
        />
        <img
          src="/assets/clipt_onboarding_security_2-bc544c81.webp"
          alt="Clipt Security Onboarding Screen 2"
          style={{ borderRadius: 24, border: "1px solid rgba(0,0,0,.1)" }}
        />
      </div>
      <p>
        A clipboard manager handles your most private data, so the design had to
        feel essentially secure and native. I didn&apos;t want it to feel like a
        &quot;utility&quot;; I wanted it to feel like a system component.
      </p>
      <h3>Typography</h3>
      <p>
        The typography aims to balance elegance with system-native familiarity.
        I paired <strong>Instrument Serif</strong> for headings to give the app
        a classic, editorial feel, with <strong>SF Pro</strong> for body text to
        ensure maximum readability and native integration.
      </p>
      <div
        className="font-showcase"
        style={{
          background: "#f5f5f7",
          padding: "2rem",
          borderRadius: 16,
          marginBottom: "2rem",
          border: "1px solid rgba(0,0,0,.05)",
        }}
      >
        <div style={{ marginBottom: "1.5rem" }}>
          <span
            style={{
              fontFamily: "Instrument Serif, serif",
              fontSize: "2.5rem",
              display: "block",
              lineHeight: 1.1,
              marginBottom: ".5rem",
            }}
          >
            Instrument Serif{" "}
            <span
              style={{
                fontSize: "1rem",
                color: "#86868b",
                fontWeight: "normal",
                marginLeft: "1rem",
                fontFamily: "SF Pro Display, sans-serif",
                verticalAlign: "middle",
              }}
            >
              Headings
            </span>
          </span>
          <span
            style={{
              fontFamily: "Instrument Serif, serif",
              fontSize: "1.2rem",
              color: "#424245",
            }}
          >
            abcdefghijklmnopqrstuvwxyz
          </span>
          <p
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: ".95rem",
              color: "#666",
              marginTop: ".8rem",
              lineHeight: 1.5,
            }}
          >
            Chosen for its high-contrast, editorial character. It breaks the
            &quot;standard app&quot; feel and treats content with the dignity of
            a printed magazine, making the clipboard history feel like a curated
            archive rather than a database dump.
          </p>
        </div>
        <div>
          <span
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: "1.5rem",
              fontWeight: 600,
              display: "block",
              marginBottom: ".5rem",
            }}
          >
            SF Pro{" "}
            <span
              style={{
                fontSize: "1rem",
                color: "#86868b",
                fontWeight: "normal",
                marginLeft: "1rem",
              }}
            >
              Body & UI
            </span>
          </span>
          <span
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: "1rem",
              color: "#424245",
            }}
          >
            The quick brown fox jumps over the lazy dog. 0123456789
          </span>
          <p
            style={{
              fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif",
              fontSize: ".95rem",
              color: "#666",
              marginTop: ".8rem",
              lineHeight: 1.5,
            }}
          >
            The gold standard for iOS legibility. Using the system font ensures
            that even though the app has a unique personality, it still feels
            native and reliable. It handles the dense information of clipboard
            content perfectly without visual clutter.
          </p>
        </div>
      </div>
      <h3>The Identity</h3>
      <p>
        While the UI uses system fonts to blend in, the brand identity needed to
        stand out.
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "2rem",
          marginBottom: "2rem",
          background: "#f5f5f7",
          padding: "2rem",
          borderRadius: 24,
          border: "1px solid rgba(0,0,0,.05)",
        }}
      >
        <img
          src="/media/5c0589_4015772c87e6491eb8881e3764409267~mv2.webp"
          alt="Clipt App Icon"
          style={{
            width: 80,
            height: 80,
            borderRadius: 18,
            boxShadow: "0 4px 12px rgba(0,0,0,.1)",
          }}
        />
        <div>
          <h4
            style={{
              margin: "0 0 .5rem",
              fontSize: "1.2rem",
              color: "#1d1d1f",
            }}
          >
            Electric Green
          </h4>
          <p
            style={{
              margin: 0,
              fontSize: ".95rem",
              color: "#666",
              lineHeight: 1.5,
            }}
          >
            I deliberately avoided the standard iOS blue. The Electric Green
            (#00D65D) signals active synchronization and energy. It tells the
            user &quot;System Active&quot; without being alarming like red or
            cautionary like yellow.
          </p>
        </div>
      </div>
      <h3>
        <ReferencePaletteIcon size={20} className="content-icon" /> The &quot;iOS 26&quot;
        Aesthetic
      </h3>
      <p>I leaned heavily into the future of iOS design:</p>
      <ul>
        <li>
          <strong>Stacked Sheets:</strong> Instead of boring lists, everything
          lives on floating sheets. This maintains context—you never feel like
          you&apos;ve left your current app.
        </li>
        <li>
          <strong>Micro-Interactions:</strong> Every action has a reaction.
          Deleting a clip creates a satisfying &quot;poof&quot; animation.
          Copying triggers a subtle haptic tap.
        </li>
        <li>
          <strong>Blur & Vibrancy:</strong> I used high-quality background blurs
          to ensure the text remains legible while feeling grounded in the
          environment.
        </li>
      </ul>
      <h3>
        <ReferenceZapIcon size={20} className="content-icon" /> Haptics as Feedback
      </h3>
      <p>I designed a &quot;Haptic Language&quot; for the app.</p>
      <div
        className="haptics-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: "1rem",
          margin: "2rem 0",
        }}
      >
        {[
          ["📸", "Copy", "Crisp, light tap"],
          ["💥", "Delete", "Heavy termination thud"],
          ["🎵", "Success", "Musical double-tap"],
        ].map(([emoji, title, text]) => (
          <div
            key={title}
            style={{
              background: "#fff",
              padding: "1.5rem",
              borderRadius: 16,
              border: "1px solid rgba(0,0,0,.05)",
              boxShadow: "0 4px 12px rgba(0,0,0,.02)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: ".5rem" }}>
              {emoji}
            </div>
            <div style={{ fontWeight: 600, marginBottom: ".2rem" }}>
              {title}
            </div>
            <div style={{ fontSize: ".9rem", color: "#86868b" }}>{text}</div>
          </div>
        ))}
      </div>
      <p>This makes the digital tool feel mechanical and reliable.</p>
      <h3>
        <MousePointer2 size={20} className="content-icon" /> A &quot;Contextual
        Agent&quot;
      </h3>
      <p>
        The biggest design shift was treating the Keyboard not as an accessory,
        but as the main character. It is a contextual agent that appears exactly
        when you need it—when you are typing. I designed the keyboard UI to be
        just as powerful as the main app, allowing you to organize, pin, and
        search without ever leaving your chat window.
      </p>
    </>
  );
}

export function CliptBlogPage() {
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001,
  });
  const [perspective, setPerspective] = useState<Perspective>("standard");
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  const current = perspectives[perspective];
  return (
    <div className="writing-container blog-post-page">
      <motion.div
        className="reading-progress-bar"
        style={{ scaleX: progress }}
      />
      <nav className="writing-nav">
        <Link href="/blogs" className="back-link">
          <ArrowLeft size={18} /> Back to Blogs
        </Link>
      </nav>
      <article className="blog-post-container">
        <header className="blog-post-header">
          <div className="blog-post-meta">
            <span className="blog-date">
              <ReferenceCalendarIcon size={14} /> Jan 26, 2026
            </span>
            <span className="blog-read-time">
              <ReferenceClockIcon size={14} /> 6 min read
            </span>
          </div>
          <h1 className="blog-post-title">
            Clipt: How I built a clipboard history app and keyboard for iOS.
            <span
              style={{
                display: "block",
                fontSize: ".7em",
                color: "#424245",
                marginTop: ".5rem",
                fontWeight: 500,
              }}
            >
              (It&apos;s complex than you think)
            </span>
          </h1>
          <p className="writing-subtitle">
            I did not want to create just another clipboard manager that sits in
            a list. I wanted to build something that felt like a native part of
            the OS, something that would make people wonder if Apple had finally
            built a clipboard manager into a future version of iOS.
          </p>
        </header>
        <img
          src="/media/5c0589_42a00ff8590c4ff5b1cf8496183b08b8~mv2.webp"
          alt="Clipt Hero"
          className="blog-post-hero-image"
        />
        <div className="blog-post-content">
          <div className="perspective-switcher-container">
            <span className="perspective-hint">View this post as:</span>
            <div className="perspective-tags">
              {(Object.values(perspectives) as (typeof current)[]).map(
                (item) => (
                  <button
                    key={item.id}
                    className={`perspective-tag ${perspective === item.id ? "active" : ""}`}
                    onClick={() => setPerspective(item.id)}
                  >
                    {item.id === "designer" && <ReferencePaletteIcon size={16} />}{" "}
                    {item.id === "eli5" && <ReferenceBabyIcon size={16} />} {item.label}
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="perspective-dynamic-content">
            <AnimatePresence mode="wait">
              <motion.div
                key={perspective}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className={`perspective-text-block ${perspective}`}
              >
                <p>{current.content}</p>
              </motion.div>
            </AnimatePresence>
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              key={`full-${perspective}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {perspective === "standard" && <StandardContent />}
              {perspective === "eli5" && <Eli5Content />}
              {perspective === "designer" && <DesignerContent />}
            </motion.div>
          </AnimatePresence>
        </div>
      </article>
      <footer className="writing-footer">
        <p>{siteCopyright}</p>
      </footer>
    </div>
  );
}
