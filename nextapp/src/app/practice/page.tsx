import { PronunciationTrainer } from "@/components/pronunciation-trainer"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-balance mb-6">parrot</h1>
        </div>
        <PronunciationTrainer />
      </div>
    </main>
  )
}