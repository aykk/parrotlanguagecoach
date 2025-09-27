"use client"

import { Background } from "@/components/background"
import { Footer } from "@/components/footer"
import { LandingPage } from "@/components/landingpage"
import { motion } from "framer-motion"

export default function Home() {
  return (
    <main className="p-inset h-[100dvh] w-full">
      <motion.div
        className="relative h-full w-full border-24 border-white rounded-3xl overflow-hidden shadow-2xl"
        initial={{ borderColor: "rgba(255, 255, 255, 0)", scale: 0.95 }}
        animate={{ borderColor: "rgba(255, 255, 255, 1)", scale: 1 }}
        transition={{ duration: 1, delay: 0.5, ease: "easeOut" }}
      >
        <Background src="/parrot-feathers.png" />
        <LandingPage />
        <Footer />
      </motion.div>
    </main>
  )
}
