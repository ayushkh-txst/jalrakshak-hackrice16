// user login page

"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  Globe,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Radio,
  CheckCircle2,
  Shield,
} from "lucide-react";
import {
  UserGoogleButton,
  UserGitHubButton,
} from "../../components/UserSocialButtons";

interface LoginPageProps {
  onSignIn?: (credentials: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => Promise<void> | void;
  onGoogleSignIn?: () => void;
  onGithubSignIn?: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({
  onSignIn,
  onGoogleSignIn,
  onGithubSignIn,
}) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      if (onSignIn) {
        await onSignIn({ email, password, rememberMe });
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to sign in."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full bg-white font-sans text-[#2c261e]">
      {/* LEFT BRAND PANEL */}
      <section className="relative flex w-full flex-col justify-between overflow-hidden bg-[#eee7db] p-8 sm:p-12 lg:w-[58%] lg:p-16">
        {/* Background Geometric Hexagon Accent */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-130 w-130 -translate-y-1/2 translate-x-[-10%] rotate-90 rounded-[40px] bg-[#e6ded0] opacity-60 blur-xs" />
        
        {/* Polygon Graphic SVG matching backdrop geometry */}
        <div className="pointer-events-none absolute right-[-5%] top-[18%] h-145 w-115 opacity-40">
          <svg viewBox="0 0 400 500" className="h-full w-full fill-[#dfd5c3]">
            <path d="M200 0 L380 100 L380 300 L200 400 L20 300 L20 100 Z" />
          </svg>
        </div>

        {/* TOP NAVBAR */}
        <header className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#ded5c4] text-[#4a3e2a]">
              <ShieldCheck size={18} strokeWidth={2.2} />
            </div>
            <span className="font-semibold tracking-tight text-[#221c15]">
              JalRakshak
            </span>
          </div>

          <button
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-[#d8cdbc] bg-[#eee7db]/60 px-3.5 py-1.5 text-xs font-medium text-[#5c4e38] transition-colors hover:bg-[#e4dbca]"
          >
            <Globe size={14} />
            <span>English</span>
            <span className="text-[10px]">▼</span>
          </button>
        </header>

        {/* MAIN HERO CONTENT */}
        <div className="relative z-10 my-auto max-w-xl py-12">
          {/* Subheader Badge */}
          <div className="mb-6 flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#736348] uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-[#736348]" />
            AI-Powered Flood Intelligence
          </div>

          {/* Heading */}
          <h1 className="font-serif text-5xl font-medium leading-[1.08] tracking-tight text-[#1c160e] sm:text-6xl lg:text-[64px]">
            Safer <br />
            Communities <br />
            <span className="text-[#86714a]">Stronger Tomorrows.</span>
          </h1>

          {/* Body */}
          <p className="mt-8 max-w-md text-sm leading-relaxed text-[#685942]">
            Real-time risk mapping, intelligent evacuation guidance, and
            emergency coordination for communities affected by floods.
          </p>

          {/* Feature Badges */}
          <div className="mt-10 flex flex-wrap items-center gap-6 text-xs font-semibold text-[#574a35]">
            <div className="flex items-center gap-2">
              <Radio size={15} className="text-[#7a6848]" />
              <span>Real-time Alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} className="text-[#7a6848]" />
              <span>Faster Response</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={15} className="text-[#7a6848]" />
              <span>Safer Communities</span>
            </div>
          </div>
        </div>

        {/* BOTTOM LANDSCAPE GRAPHIC */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 overflow-hidden opacity-75">
          <svg
            viewBox="0 0 1000 160"
            preserveAspectRatio="none"
            className="h-full w-full fill-[#ded4c1]"
          >
            <path d="M0 80 Q 250 120 500 70 T 1000 90 L 1000 160 L 0 160 Z" />
            <path
              d="M0 100 Q 300 60 600 110 T 1000 80 L 1000 160 L 0 160 Z"
              fill="#d3c7b1"
              opacity="0.7"
            />
          </svg>
          <div className="absolute bottom-3 left-[22%] h-12 w-10 border-b-2 border-l-2 border-r-2 border-[#a89b82]/60" />
        </div>
      </section>

      {/* RIGHT LOGIN FORM PANEL */}
      <section className="flex w-full items-center justify-center bg-white px-6 py-12 lg:w-[42%] lg:px-16">
        <div className="w-full max-w-sm">
          {/* Header */}
          <div className="mb-8">
            <h2 className="font-serif text-3xl font-medium tracking-tight text-[#1a140d] sm:text-4xl">
              Welcome Back
            </h2>
            <p className="mt-2 text-xs text-[#8c7e6b]">
              Sign in to continue to JalRakshak
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Email Field */}
            <div>
              <div className="relative flex items-center rounded-xl border border-[#ece4d8] bg-[#faf8f5] px-3.5 py-3 transition-within:border-[#9e8865]">
                <Mail size={16} className="text-[#b0a28f]" />
                <input
                  type="email"
                  required
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-transparent px-3 text-sm text-[#2c241b] outline-none placeholder:text-[#b5a795]"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="relative flex items-center rounded-xl border border-[#ece4d8] bg-[#faf8f5] px-3.5 py-3 transition-within:border-[#9e8865]">
                <Lock size={16} className="text-[#b0a28f]" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-transparent px-3 text-sm text-[#2c241b] outline-none placeholder:text-[#b5a795]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#b0a28f] hover:text-[#6e5d44]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between pt-1 text-xs text-[#736551]">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[#d6cbba] accent-[#615139]"
                />
                <span>Remember me</span>
              </label>

              <button
                type="button"
                className="font-medium text-[#736551] hover:underline"
              >
                Forgot password?
              </button>
            </div>

            {errorMessage && (
              <p className="text-xs text-red-600">{errorMessage}</p>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 flex w-full items-center justify-center rounded-xl bg-[#615139] py-3 text-sm font-medium text-white transition-all hover:bg-[#50422e] active:scale-[0.99] disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in →"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#ece5d9]" />
            <span className="text-[11px] font-medium text-[#ab9d8a]">
              or continue with
            </span>
            <div className="h-px flex-1 bg-[#ece5d9]" />
          </div>

          {/* Reusable Social Sign-in Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <UserGoogleButton onClick={onGoogleSignIn} disabled={isLoading} />
            <UserGitHubButton onClick={onGithubSignIn} disabled={isLoading} />
          </div>

          {/* Footer Contact text */}
          <p className="mt-8 text-center text-xs text-[#998b77]">
            Don't have an account?{" "}
            <button
              type="button"
              className="font-bold text-[#2c241b] hover:underline"
            >
              Contact your administrator
            </button>
          </p>
        </div>
      </section>
    </div>
  );
};

export default LoginPage;