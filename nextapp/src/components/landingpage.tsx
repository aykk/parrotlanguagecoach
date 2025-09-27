"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { Button } from "./ui/button"
import { motion } from "framer-motion"
import Image from "next/image"
import { useRouter } from "next/navigation"

export const LandingPage = () => {
  const [currentWordIndex, setCurrentWordIndex] = useState(0)
  const rotatingWords = ["confidence", "clarity", "fluency", "accuracy"]
  const router = useRouter()

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWordIndex((prev) => (prev + 1) % rotatingWords.length)
    }, 2000) // Change word every 2 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex overflow-hidden relative flex-col gap-2 justify-center items-center pt-4 w-full h-full short:lg:pt-6 pb-footer-safe-area 2xl:pt-footer-safe-area px-sides short:lg:gap-2 lg:gap-4">
      <motion.div
        layout="position"
        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative -top-16"
      >
        <Image
          src="/logo.png"
          alt="Parrot Logo"
          width={460}
          height={230}
          className="w-auto h-[18.4rem] sm:h-[23rem] lg:h-[32.2rem] object-contain my-0 py-0 drop-shadow-2xl"
          priority
        />
      </motion.div>

      <motion.p
        className="text-2xl sm:text-3xl lg:text-4xl text-white/80 font-semibold italic mb-6 text-center leading-relaxed tracking-wide relative -top-40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      >
        Speak with{" "}
        <span className="italic inline-block">
          <motion.span
            key={rotatingWords[currentWordIndex]}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{
              duration: 0.6,
              ease: [0.25, 0.46, 0.45, 0.94],
              type: "tween",
            }}
            className="inline-block underline"
          >
            {rotatingWords[currentWordIndex]}
          </motion.span>.
        </span>
      </motion.p>

      <div className="flex flex-col items-center min-h-0 shrink">
        <motion.div
          layout="position"
          className="relative -top-34"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
        >
          <div className="flex gap-6 items-center">
            <Button 
              onClick={() => router.push("/practice")}
              className="px-10 py-3 bg-white/15 hover:bg-white/25 text-white border-white/40 hover:border-white/60 backdrop-blur-md transition-all duration-300 font-medium text-base"
            >
              Continue as guest
            </Button>
            <Button className="px-10 py-3 bg-white/85 text-black hover:bg-white/80 border-white transition-all duration-300 font-medium text-base">
              Sign in
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}