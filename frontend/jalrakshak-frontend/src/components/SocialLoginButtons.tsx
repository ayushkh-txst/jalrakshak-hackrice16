"use client";

import React from "react";

interface SocialLoginButtonsProps {
  onGoogleClick?: () => void;
  onGithubClick?: () => void;
  isLoading?: boolean;
}

export const SocialLoginButtons: React.FC<SocialLoginButtonsProps> = ({
  onGoogleClick,
  onGithubClick,
  isLoading = false,
}) => {
  // Default Google OAuth Redirection Handler
  const handleGoogleAuth = () => {
    if (onGoogleClick) {
      onGoogleClick();
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

    if (!clientId) {
      console.error(
        "Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env.local file."
      );
      alert("Google Client ID is not configured in .env.local");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      prompt: "select_account",
      state: "provider=google",
    });

    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    window.location.href = googleAuthUrl;
  };

  // Default GitHub OAuth Redirection Handler
  const handleGithubAuth = () => {
    if (onGithubClick) {
      onGithubClick();
      return;
    }

    const clientId = process.env.NEXT_PUBLIC_GITHUB_CLIENT_ID;

    if (!clientId) {
      console.error(
        "Missing NEXT_PUBLIC_GITHUB_CLIENT_ID in your .env.local file."
      );
      alert("GitHub Client ID is not configured in .env.local");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/callback`;

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user user:email",
      state: "provider=github",
    });

    const githubAuthUrl = `https://github.com/login/oauth/authorize?${params.toString()}`;

    window.location.href = githubAuthUrl;
  };

  return (
    <div className="grid grid-cols-2 gap-3.25">
      {/* Google Button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleGoogleAuth}
        className="flex h-19 items-center justify-center gap-3 rounded-[10px] border border-[#ded3c2] bg-white px-4 text-[15px] font-semibold text-[#2b231a] transition-all hover:border-[#c9baa2] hover:bg-[#fcfaf6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#68501e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          className="text-[21px] font-bold leading-none"
          style={{
            fontFamily: "Arial, sans-serif",
            background:
              "linear-gradient(90deg,#4285F4 0%,#34A853 35%,#FBBC05 65%,#EA4335 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          G
        </span>
        <span className="text-center leading-5">
          Continue with
          <br />
          Google
        </span>
      </button>

      {/* GitHub Button */}
      <button
        type="button"
        disabled={isLoading}
        onClick={handleGithubAuth}
        className="flex h-19 items-center justify-center gap-3 rounded-[10px] bg-[#17110b] px-4 text-[15px] font-semibold text-white transition-all hover:bg-[#0f0b07] hover:shadow-[0_8px_20px_rgba(23,17,11,0.14)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#68501e] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <svg
          width="21"
          height="21"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.05c-3.34.73-4.04-1.61-4.04-1.61-.55-1.4-1.34-1.77-1.34-1.77-1.09-.75.08-.74.08-.74 1.2.09 1.84 1.23 1.84 1.23 1.07 1.83 2.8 1.3 3.49.99.11-.77.42-1.3.76-1.6-2.66-.3-5.46-1.33-5.46-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.24 1.91 1.24 3.22 0 4.61-2.8 5.62-5.47 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.57A12 12 0 0 0 12 .5Z" />
        </svg>
        <span className="text-center leading-5">
          Continue with
          <br />
          GitHub
        </span>
      </button>
    </div>
  );
};