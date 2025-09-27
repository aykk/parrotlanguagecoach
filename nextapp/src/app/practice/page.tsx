"use client"

import { PronunciationTrainer } from "@/components/pronunciation-trainer"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon } from "@radix-ui/react-icons"
import { useRouter } from "next/navigation"

export default function Home() {
  const router = useRouter()

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Button 
            onClick={() => router.push("/")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeftIcon className="size-4" />
            Back to Home
          </Button>
        </div>
        <PronunciationTrainer />
      </div>
    </main>
  )
}