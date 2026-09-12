"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Globe2,
  LockKeyhole,
  Mail,
  MapPin,
  Shield,
  UsersRound,
  Waves,
} from "lucide-react";
import { SocialLoginButtons } from "../../components/SocialLoginButtons";

interface AdminPageProps {
  onSignIn?: (credentials: {
    email: string;
    password: string;
    rememberMe: boolean;
  }) => Promise<void> | void;
  onNavigateToUserLogin?: () => void;
  onBackHome?: () => void;
  onGoogleSignIn?: () => void;
  onGithubSignIn?: () => void;
}

const AdminPage: React.FC<AdminPageProps> = ({
  onSignIn,
  onNavigateToUserLogin,
  onBackHome,
  onGoogleSignIn,
  onGithubSignIn,
}) => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);

  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const [successMessage, setSuccessMessage] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");

  const handleUserLoginNavigation = () => {
    if (onNavigateToUserLogin) {
      onNavigateToUserLogin();
    } else if (onBackHome) {
      onBackHome();
    } else {
      router.push("/login");
    }
  };

  const validate = () => {
    let valid = true;

    setEmailError("");
    setPasswordError("");
    setGeneralError("");
    setSuccessMessage("");
    setForgotMessage("");

    if (!email.trim()) {
      setEmailError("Email address is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    } else if (password.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!validate()) return;

    setIsLoading(true);
    setGeneralError("");
    setSuccessMessage("");

    try {
      if (onSignIn) {
        await onSignIn({
          email: email.trim(),
          password,
          rememberMe,
        });
      } else {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setSuccessMessage("Sign in successful.");
      }
    } catch (error) {
      setGeneralError(
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    setForgotMessage(
      "Please contact your administrator to reset your password."
    );
    setGeneralError("");
    setSuccessMessage("");
  };

  return (
    <>
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap');

          .jalrakshak-page {
            font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          }

          .jalrakshak-display {
            font-family: 'Playfair Display', Georgia, serif;
          }

          .jalrakshak-noise {
            position: absolute;
            inset: 0;
            pointer-events: none;
            opacity: 0.025;
            background-image:
              url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.5'/%3E%3C/svg%3E");
          }

          @keyframes jalrakshakFloat {
            0%, 100% {
              transform: translateY(0px);
            }
            50% {
              transform: translateY(-6px);
            }
          }

          .jalrakshak-float {
            animation: jalrakshakFloat 5s ease-in-out infinite;
          }

          @keyframes jalrakshakLoading {
            0% {
              transform: translateX(-120%);
            }
            100% {
              transform: translateX(320%);
            }
          }

          .jalrakshak-loading-bar {
            animation: jalrakshakLoading 1.2s ease-in-out infinite;
          }
        `}
      </style>

      <div className="jalrakshak-page min-h-screen w-full bg-[#f7f3ec] text-[#21180f]">
        <div className="flex min-h-screen flex-col lg:flex-row">
          {/* BRANDING PANEL */}
          <section className="relative min-h-170 w-full overflow-hidden bg-[#f4ecdd] lg:min-h-screen lg:w-[64%]">
            <div className="jalrakshak-noise" />

            {/* Central Shield Graphic */}
            <div className="jalrakshak-float pointer-events-none absolute left-[35%] top-[11%] hidden h-125 w-105 lg:block">
              <svg
                viewBox="0 0 420 500"
                className="h-full w-full"
                aria-hidden="true"
              >
                <path
                  d="M210 8 L414 102 V265 C414 383 332 457 210 496 C88 457 6 383 6 265 V102 Z"
                  fill="#e8decd"
                />
                <path
                  d="M108 272 C142 238 164 238 195 252 C226 266 249 274 278 269 C298 266 313 257 326 245"
                  fill="none"
                  stroke="#f4ecdd"
                  strokeWidth="16"
                  strokeLinecap="round"
                />
                <path
                  d="M145 218 C167 194 186 181 210 170 C234 181 253 194 275 218 C250 205 230 203 210 204 C190 203 170 205 145 218"
                  fill="#f4ecdd"
                />
              </svg>
            </div>

            {/* TOP NAVIGATION */}
            <header className="relative z-20 flex items-center justify-between px-6 py-7 sm:px-10 lg:px-14.5 lg:py-9.5">
              <button
                type="button"
                onClick={handleUserLoginNavigation}
                className="group flex items-center gap-4 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#6a5220] focus-visible:ring-offset-4 focus-visible:ring-offset-[#f4ecdd]"
                aria-label="JalRakshak home"
              >
                <div className="relative flex h-11.5 w-11.5 items-center justify-center rounded-[10px] bg-[#e9dfcd]">
                  <Shield size={32} strokeWidth={1.8} className="text-[#68501f]" />
                  <Waves size={17} strokeWidth={2.2} className="absolute left-3.5 top-4.5 text-[#68501f]" />
                </div>
                <span className="jalrakshak-display text-[24px] font-bold tracking-[-0.6px] text-[#19130d]">
                  JalRakshak
                </span>
              </button>

              <button
                type="button"
                onClick={handleUserLoginNavigation}
                className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-2 text-[15px] font-medium text-[#806b4b] transition-colors hover:text-[#574319] sm:flex"
              >
                <ArrowLeft size={18} strokeWidth={1.7} />
                <span>User Login Page</span>
              </button>

              <div className="relative">
                <button
                  type="button"
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-[15px] font-medium text-[#806b4b] outline-none transition-colors hover:bg-[#eadfcd] focus-visible:ring-2 focus-visible:ring-[#6a5220]"
                >
                  <Globe2 size={18} strokeWidth={1.7} />
                  <span>English</span>
                  <ChevronDown size={16} strokeWidth={1.8} />
                </button>
              </div>
            </header>

            {/* HERO CONTENT */}
            <div className="relative z-10 px-6 pb-28 pt-12 sm:px-10 sm:pt-16 lg:px-14.5 lg:pb-24 lg:pt-17">
              <div className="mb-8 flex items-center gap-2.5">
                <span className="h-2.25 w-2.25 rounded-full bg-[#67501e]" />
                <span className="text-[12px] font-medium uppercase tracking-[2.1px] text-[#6a5224]">
                  AI-POWERED FLOOD INTELLIGENCE
                </span>
              </div>

              <h1 className="jalrakshak-display relative max-w-142.5 text-[54px] font-semibold leading-[0.98] tracking-[-2.2px] text-[#19130d] sm:text-[64px] lg:text-[64px] xl:text-[67px]">
                <span className="block">Safer</span>
                <span className="block">Communities</span>
                <span className="block text-[#6b5220]">Stronger</span>
                <span className="block text-[#6b5220]">Tomorrows.</span>
              </h1>

              <p className="mt-8 max-w-142.5 text-[16px] font-normal leading-[1.8] text-[#806e54] sm:text-[17px]">
                Real-time risk mapping, intelligent evacuation guidance, and emergency coordination for communities affected by floods.
              </p>

              {/* FEATURES ROW */}
              <div className="relative z-10 mt-8 flex flex-wrap items-center gap-x-9 gap-y-5 text-[#4e4129]">
                <div className="flex items-center gap-2.5">
                  <MapPin size={20} strokeWidth={1.8} className="text-[#725c2c]" />
                  <span className="text-[14px] font-semibold">Real-time Alerts</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <UsersRound size={20} strokeWidth={1.8} className="text-[#725c2c]" />
                  <span className="text-[14px] font-semibold">Faster Response</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Shield size={20} strokeWidth={1.8} className="text-[#725c2c]" />
                  <span className="text-[14px] font-semibold">Safer Communities</span>
                </div>
              </div>
            </div>

            {/* FLOOD LANDSCAPE */}
            <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-51.25">
              <svg
                viewBox="0 0 1000 230"
                preserveAspectRatio="none"
                className="absolute bottom-0 h-full w-full"
                aria-hidden="true"
              >
                <path
                  d="M0 100 C75 78 120 112 190 102 C270 91 301 118 365 110 C442 100 479 67 555 73 C632 80 655 112 722 109 C813 104 873 65 1000 45 V230 H0 Z"
                  fill="#d6c19f"
                />
                <path
                  d="M0 130 C84 116 117 150 198 145 C286 139 315 105 395 107 C465 109 491 133 563 130 C642 126 688 98 757 100 C844 103 908 116 1000 99 V230 H0 Z"
                  fill="#cbb692"
                />
                <path
                  d="M0 157 C92 149 135 176 229 164 C320 152 348 140 436 153 C527 167 590 164 670 149 C772 131 837 143 1000 123 V230 H0 Z"
                  fill="#c5af89"
                />
              </svg>

              <div className="absolute bottom-0 left-0 h-17.5 w-full">
                <div className="absolute bottom-0 -left-2 h-12.5 w-3.75 bg-[#8e7959]" />
                <div className="absolute bottom-7.5 -left-1 h-9 w-9 rounded-full bg-[#9b8765]" />
                <div className="absolute bottom-0 left-7.75 h-11.25 w-3.25 bg-[#806b4e]" />
                <div className="absolute bottom-7.25 left-5.25 h-9.25 w-9.5 rounded-full bg-[#9b8765]" />
                <div className="absolute bottom-0 -right-1.5 h-14 w-3.5 bg-[#8b7656]" />
                <div className="absolute bottom-8.5 -right-3.25 h-11.25 w-11.25 rounded-full bg-[#a18b68]" />
              </div>

              <div className="absolute bottom-2.75 left-[34%] h-6.5 w-25.5">
                <div className="absolute bottom-0 left-0 h-0.5 w-full bg-[#725b3c]" />
                <div className="absolute bottom-px left-4.5 h-5.75 w-0.5 bg-[#725b3c]" />
                <div className="absolute bottom-px left-12.75 h-5.75 w-0.5 bg-[#725b3c]" />
                <div className="absolute bottom-1 right-18 h-23 w-2 bg-[#725b3c]" />
                <div className="absolute bottom-2.75 left-0 h-5 w-full rounded-[50%] border-t-2 border-[#725b3c]" />
              </div>

              <div className="absolute bottom-3.25 left-[45%] flex gap-5">
                <div className="relative h-10.75 w-1 bg-[#89724e]">
                  <div className="absolute -left-0.5 top-0 h-2 w-2 skew-x-[-20deg] bg-[#89724e]" />
                </div>
                <div className="relative h-9.25 w-1 bg-[#89724e]">
                  <div className="absolute -left-0.5 top-0 h-2 w-2 skew-x-[-20deg] bg-[#89724e]" />
                </div>
              </div>
            </div>
          </section>

          {/* LOGIN PANEL */}
          <section className="flex min-h-screen w-full items-center justify-center bg-[#faf8f4] px-6 py-12 sm:px-10 lg:w-[36%] lg:px-12.5 lg:py-10">
            <div className="w-full max-w-112.5">
              <div className="mb-9">
                <h2 className="jalrakshak-display text-[39px] font-semibold leading-[1.05] tracking-[-1.3px] text-[#1c150f] sm:text-[42px]">
                  Welcome Back
                </h2>
                <p className="mt-3 text-[16px] leading-6 text-[#8a7658]">
                  Sign in to continue to JalRakshak
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate className="space-y-0">
                {/* Email Input */}
                <div className="mb-4">
                  <label htmlFor="email" className="sr-only">
                    Email address
                  </label>
                  <div
                    className={`group relative flex h-14.75 items-center rounded-[10px] border bg-[#fffefd] transition-all ${
                      emailError
                        ? "border-red-400 ring-2 ring-red-100"
                        : "border-[#ded3c2] focus-within:border-[#907544] focus-within:ring-2 focus-within:ring-[#e9dfce]"
                    }`}
                  >
                    <Mail size={20} strokeWidth={1.6} className="ml-4 shrink-0 text-[#ae916b]" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setEmailError("");
                      }}
                      placeholder="Email address"
                      className="h-full min-w-0 flex-1 bg-transparent px-4 text-[16px] text-[#33281c] outline-none placeholder:text-[#a59b90]"
                    />
                  </div>
                  {emailError && (
                    <p className="mt-1.5 px-1 text-xs text-red-600">{emailError}</p>
                  )}
                </div>

                {/* Password Input */}
                <div className="mb-4">
                  <label htmlFor="password" className="sr-only">
                    Password
                  </label>
                  <div
                    className={`group relative flex h-14.75 items-center rounded-[10px] border bg-[#fffefd] transition-all ${
                      passwordError
                        ? "border-red-400 ring-2 ring-red-100"
                        : "border-[#ded3c2] focus-within:border-[#907544] focus-within:ring-2 focus-within:ring-[#e9dfce]"
                    }`}
                  >
                    <LockKeyhole size={19} strokeWidth={1.6} className="ml-4 shrink-0 text-[#ae916b]" />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setPasswordError("");
                      }}
                      placeholder="Password"
                      className="h-full min-w-0 flex-1 bg-transparent px-4 text-[16px] text-[#33281c] outline-none placeholder:text-[#a59b90]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="mr-3 flex h-9 w-9 items-center justify-center rounded-full text-[#ae916b] outline-none transition-colors hover:bg-[#f0e9dd] hover:text-[#715725] focus-visible:ring-2 focus-visible:ring-[#8a6e38]"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff size={19} strokeWidth={1.6} /> : <Eye size={19} strokeWidth={1.6} />}
                    </button>
                  </div>
                  {passwordError && (
                    <p className="mt-1.5 px-1 text-xs text-red-600">{passwordError}</p>
                  )}
                </div>

                {/* Options Row */}
                <div className="mb-6 flex items-center justify-between gap-4">
                  <label htmlFor="rememberMe" className="flex cursor-pointer select-none items-center gap-2.5 text-[14px] font-medium text-[#66543a]">
                    <span className="relative flex h-5 w-5">
                      <input
                        id="rememberMe"
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer h-5 w-5 cursor-pointer appearance-none rounded-[3px] border border-[#958b7e] bg-white transition-all checked:border-[#68501e] checked:bg-[#68501e] focus:ring-2 focus:ring-[#dcd0bc]"
                      />
                      {rememberMe && (
                        <Check size={14} strokeWidth={3} className="pointer-events-none absolute left-0.75 top-0.75 text-white" />
                      )}
                    </span>
                    Remember me
                  </label>

                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[14px] font-semibold text-[#68501e] transition-colors hover:text-[#43330f]"
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Feedback Alerts */}
                {forgotMessage && (
                  <div className="mb-4 rounded-lg border border-[#dfd2bd] bg-[#f4eddf] px-4 py-3 text-sm leading-5 text-[#68501e]">
                    {forgotMessage}
                  </div>
                )}
                {generalError && (
                  <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {generalError}
                  </div>
                )}
                {successMessage && (
                  <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                    {successMessage}
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="relative flex h-15 w-full items-center justify-center overflow-hidden rounded-[10px] bg-[#68501e] text-[17px] font-bold text-white shadow-sm transition-all duration-200 hover:bg-[#594319] hover:shadow-[0_8px_20px_rgba(89,67,25,0.18)] active:scale-[0.995] disabled:cursor-not-allowed disabled:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#68501e] focus-visible:ring-offset-2"
                >
                  {isLoading ? (
                    <>
                      <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Signing in...
                    </>
                  ) : (
                    "Sign in →"
                  )}
                  {isLoading && (
                    <span className="jalrakshak-loading-bar absolute bottom-0 left-0 h-0.5 w-1/3 bg-white/70" />
                  )}
                </button>
              </form>

              {/* Divider */}
              <div className="my-7.25 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#ddd4c7]" />
                <span className="whitespace-nowrap text-[13px] font-medium text-[#a28e70]">
                  or continue with
                </span>
                <div className="h-px flex-1 bg-[#ddd4c7]" />
              </div>

              {/* Reusable Social Login Buttons */}
              <SocialLoginButtons
                isLoading={isLoading}
                onGoogleClick={onGoogleSignIn}
                onGithubClick={onGithubSignIn}
              />

              {/* Footer text */}
              <p className="mt-7 text-center text-[15px] leading-6 text-[#ae9674]">
                Don't have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setForgotMessage("");
                    setGeneralError(
                      "Please contact your administrator for an account."
                    );
                  }}
                  className="font-bold text-[#68501e] transition-colors hover:text-[#44330f]"
                >
                  Contact your administrator
                </button>
              </p>
            </div>
          </section>
        </div>
      </div>
    </>
  );
};

export default AdminPage;