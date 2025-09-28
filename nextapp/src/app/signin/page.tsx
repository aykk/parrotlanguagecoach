"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeftIcon, EnterIcon, PersonIcon } from "@radix-ui/react-icons";
import { motion } from "framer-motion";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let unsub: { unsubscribe: () => void } | null = null;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        setUserEmail(data.user?.email ?? null);
        const sub = supabase.auth.onAuthStateChange((_e, session) => {
          setUserEmail(session?.user?.email ?? null);
        });
        unsub = sub.data?.subscription ?? null;
      } catch (e: any) {
        setMsg(e?.message ?? "Auth init failed");
      }
    };
    init();

    return () => unsub?.unsubscribe();
  }, []);

  const signUp = async () => {
    setMsg(null);
    setLoading(true);
    
    if (!email.trim()) {
      setMsg("Missing email");
      setLoading(false);
      return;
    }
    if (!password.trim()) {
      setMsg("Missing password");
      setLoading(false);
      return;
    }
    
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else setMsg("Check your inbox to confirm, then sign in.");
    setLoading(false);
  };

  const signIn = async () => {
    setMsg(null);
    setLoading(true);
    
    if (!email.trim()) {
      setMsg("Missing email");
      setLoading(false);
      return;
    }
    if (!password.trim()) {
      setMsg("Missing password");
      setLoading(false);
      return;
    }
    
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
    setLoading(false);
  };

  const signOut = async () => { 
    await supabase.auth.signOut(); 
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/practice`
      }
    });
    if (error) {
      setMsg(error.message);
    }
    setLoading(false);
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background with parrotparade.jpg */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/parrotparade.jpg"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black/40" />
      </div>
      
      {/* Back to home button */}
      <div className="absolute top-4 left-4 z-10">
        <Button asChild variant="outline" className="flex items-center gap-2 bg-white/90 hover:bg-white/95 border-white/20 text-gray-800">
          <Link href="/">
            <ArrowLeftIcon className="size-4" />
            Back to Home
          </Link>
        </Button>
      </div>
      
      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <Card className="bg-white/90 backdrop-blur-md border-white/20 shadow-2xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4 -mt-9">
              <Image
                src="/blacklogo.png"
                alt="Parrot Language Coach"
                width={400}
                height={200}
                className="object-contain"
              />
            </div>
            <div className="text-center mb-4 -mt-12">
              <p className="text-lg font-medium text-gray-700">Join now — for free!</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 -mt-12">
            {userEmail ? (
              <div className="space-y-4 text-center mt-8">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-green-800">
                    Signed in as <span className="font-semibold">{userEmail}</span>
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <Button asChild className="w-full bg-green-700 hover:bg-green-800 text-white">
                    <Link href="/practice">Start Practicing</Link>
                  </Button>
                  <Button variant="outline" onClick={signOut} className="w-full bg-white/80 hover:bg-white/90 border-gray-300">
                    Sign out
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-700">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="bg-white/80 border-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-gray-700">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="bg-white/80 border-gray-300"
                  />
                </div>
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <Button 
                      onClick={signUp} 
                      variant="outline" 
                      className="flex-1 bg-white/80 hover:bg-white/90 border-gray-300 flex items-center gap-2"
                      disabled={loading}
                    >
                      <PersonIcon className="w-4 h-4" />
                      {loading ? "Loading..." : "Sign up"}
                    </Button>
                    <Button 
                      onClick={signIn} 
                      variant="outline"
                      className="flex-1 bg-white/80 hover:bg-white/90 border-gray-300 flex items-center gap-2"
                      disabled={loading}
                    >
                      <EnterIcon className="w-4 h-4" />
                      {loading ? "Loading..." : "Sign in"}
                    </Button>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-300" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white/90 px-2 text-gray-500">
                        Or continue with
                      </span>
                    </div>
                  </div>
                  
                  <Button 
                    onClick={signInWithGoogle} 
                    variant="outline" 
                    className="w-full bg-white/80 hover:bg-white/90 border-gray-300"
                    disabled={loading}
                  >
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {loading ? "Loading..." : "Continue with Google"}
                  </Button>
                </div>
              </div>
            )}

            {msg && (
              <div className={`p-3 rounded-lg text-sm ${
                msg.includes("Check your inbox") 
                  ? "bg-green-50 text-green-800 border border-green-200" 
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {msg}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
