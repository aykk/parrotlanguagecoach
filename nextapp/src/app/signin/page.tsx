"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setMsg(error.message);
    else setMsg("Check your inbox to confirm, then sign in.");
    setLoading(false);
  };

  const signIn = async () => {
    setMsg(null);
    setLoading(true);
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
    <main className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-gray-900">Parrot Language Coach</CardTitle>
          <CardDescription>Sign in to track your pronunciation progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {userEmail ? (
            <div className="space-y-4 text-center">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-800">
                  Signed in as <span className="font-semibold">{userEmail}</span>
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <Button asChild className="w-full">
                  <Link href="/practice">Start Practicing</Link>
                </Button>
                <Button variant="ghost" onClick={signOut} className="w-full">
                  Sign out
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                />
              </div>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <Button 
                    onClick={signUp} 
                    variant="outline" 
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Sign up"}
                  </Button>
                  <Button 
                    onClick={signIn} 
                    className="flex-1"
                    disabled={loading}
                  >
                    {loading ? "Loading..." : "Sign in"}
                  </Button>
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or continue with
                    </span>
                  </div>
                </div>
                
                <Button 
                  onClick={signInWithGoogle} 
                  variant="outline" 
                  className="w-full"
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
                ? "bg-blue-50 text-blue-800 border border-blue-200" 
                : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              {msg}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
