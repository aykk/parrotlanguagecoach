"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase-client";
import { progressTracker } from "@/lib/progress-tracker";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export const AuthHeader = () => {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [loadingDots, setLoadingDots] = useState("");
  const dotsRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Animate loading dots
    let dotCount = 0;
    dotsRef.current = setInterval(() => {
      dotCount = (dotCount + 1) % 4; // 0, 1, 2, 3
      setLoadingDots(".".repeat(dotCount));
    }, 500);

    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUser(data.user);
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
          setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
      } catch (e: any) {
        console.error("Auth init failed:", e);
      } finally {
        setLoading(false);
        if (dotsRef.current) {
          clearInterval(dotsRef.current);
        }
      }
    };
    init();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    // Clear all progress data and trigger dashboard refresh
    progressTracker.clearAllData();
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("progressUpdated"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Image
          src="/parrot.gif"
          alt="Loading..."
          width={96}
          height={96}
          className="w-24 h-24 object-contain"
        />
        <span className="text-sm text-gray-600">
          Loading{loadingDots}
        </span>
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-500 text-white text-sm">
              {user.email?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-gray-600 hidden sm:block">
            {user.email}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={signOut}>
          Log out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild size="sm">
        <Link href="/signin">Sign in</Link>
      </Button>
    </div>
  );
};
