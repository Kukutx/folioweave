import { products } from "@/config/products";
import type { WorkItem } from "./schema";

export const workItems = {
  district: {
    name: products.district.name,
    date: "Jan 2025 — Apr 2026",
    desktopImage:
      "/media/5c0589_7a30aeef55604850b2cb9994e87dd196~mv2.webp",
    mobileImage:
      "/media/5c0589_0a1ded0ebf574f41a427c109a3ab6ca8~mv2.webp",
    icon: products.district.icon,
    description:
      "I design for the Movies vertical at District by Zomato, facilitating over 75 million ticket sales. My focus is on creating scalable, easy-to-use flows that balance business goals with a great user experience.",
  },
  brink: {
    name: products.brink.name,
    date: "Feb 2026 — Present",
    desktopImage: "/media/brink-work-desktop.jpg",
    mobileImage: "/media/brink-work-mobile.jpg",
    icon: products.brink.icon,
    description:
      "A podcast player and news app I designed and built solo — discovery, playback, and headlines all in one place. Features include trending podcast recommendations, timestamped bookmarks, and a walking mode. Built with a modern Liquid Glass design for iOS.",
  },
  clipt: {
    name: products.clipt.name,
    date: "Jan 2026",
    desktopImage:
      "/media/5c0589_f2650350f5424f63986ad52a542e14b7~mv2.webp",
    mobileImage:
      "/media/5c0589_4397853e33df48cbae9a1f8b56d8417f~mv2.webp",
    icon: products.clipt.icon,
    description:
      "I designed and built Clipt to solve a personal pain point: the lack of a native, synced clipboard history on iOS. Built with SwiftUI and SwiftData, it features a custom keyboard extension for instant access to your clips, seamless iCloud synchronization, and a polished, native feel that fits perfectly into the Apple ecosystem.",
  },
  habee: {
    name: products.habee.name,
    date: "Jan 2026",
    desktopImage:
      "/media/5c0589_8035037444ae49d2bb661f3a5c001786~mv2.webp",
    mobileImage:
      "/media/5c0589_e510a0a265744c628a6f5be98d165764~mv2.webp",
    description:
      "A minimal habit tracker built with SwiftUI — simple, focused, and designed to help you build better routines without overwhelming you with features.",
  },
  ogWalls: {
    name: products.ogWalls.name,
    date: "Aug 2025",
    desktopImage:
      "/media/5c0589_b6de3c913beb49b386b9792f9f4ade48~mv2.webp",
    mobileImage:
      "/media/5c0589_4ea5c5899e764cfc9e88a6e43827f725~mv2.webp",
    description:
      "OG Walls is an Android app I built that offers a free collection of high-quality wallpapers. All the photos in the app are original and were captured by me. The app is a showcase of my personal photography portfolio, giving users a unique and refreshing alternative to generic stock photos.",
  },
  notchShelf: {
    name: products.notchShelf.name,
    date: "Jan 2026",
    icon: products.notchShelf.icon,
    description:
      'I turned the MacBook Notch into a functional workspace! NotchShelf transforms that "dead space" into a dynamic utility belt with a Quick Shelf for files, a Screenshot Magnet, and a Quick Mirror. Built with SwiftUI as my first macOS app, it reached #1 Paid App in India on the Mac App Store.',
  },
} as const satisfies Record<string, WorkItem>;
