import { GitHubLogoIcon } from "@radix-ui/react-icons"
import { buttonVariants } from "./ui/button"
import DevpostIcon from "./icons/devpost"
import { socialLinks } from "@/lib/constants"
import Link from "next/link"

export const Footer = () => {
  return (
    <div className="flex gap-8 items-center absolute bottom-[calc(var(--inset)-1rem)] md:bottom-[calc(var(--inset)-0.5rem)] left-1/2 -translate-x-1/2">
      <Link 
        target="_blank" 
        className="p-3 bg-white/20 hover:bg-white/30 text-white border border-white/40 hover:border-white/60 backdrop-blur-md transition-all duration-300 rounded-full hover:scale-110" 
        href={socialLinks.devpost}
      >
        <DevpostIcon className="size-6" />
      </Link>
      <Link 
        target="_blank" 
        className="p-3 bg-white/20 hover:bg-white/30 text-white border border-white/40 hover:border-white/60 backdrop-blur-md transition-all duration-300 rounded-full hover:scale-110" 
        href={socialLinks.github}
      >
        <GitHubLogoIcon className="size-6" />
      </Link>
    </div>
  )
}
