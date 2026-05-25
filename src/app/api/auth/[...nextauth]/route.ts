import NextAuth from "next-auth"
import type { NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"
import CredentialsProvider from "next-auth/providers/credentials"

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "dummy_id",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "dummy_secret",
    }),
    CredentialsProvider({
      name: "Developer Test Account",
      credentials: {
        email: { label: "Email", type: "email", placeholder: "you@example.com" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          // 1. Send the login request to your secure FastAPI backend
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000";
          const res = await fetch(`${backendUrl}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password
            })
          });

          if (!res.ok) {
            console.error(`Backend auth returned status: ${res.status}`);
            return null;
          }

          const data = await res.json();

          // 2. Extract out the nested user profile and access_token payload
          if (data && data.access_token && data.user) {
            return {
              id: data.user.email,
              name: data.user.name,
              email: data.user.email,
              backendToken: data.access_token // Pass token down to the NextAuth lifecycle
            };
          }
        } catch (e) {
          console.error("Connection error in NextAuth authorization worker:", e);
        }
        return null;
      }
    })
  ],
  callbacks: {
    // 3. Intercept the user object and save the backend token into the NextAuth encrypted JWT
    async jwt({ token, user }) {
      if (user) {
        token.accessToken = user.backendToken;
      }
      return token;
    },
    // 4. Inject the token from the JWT into the client-facing session context
    async session({ session, token }) {
      if (token && session.user) {
        session.accessToken = token.accessToken;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // Redirects users here for custom login page layouts
  },
  session: {
    strategy: "jwt" // Essential for processing token state logic seamlessly
  },
  secret: process.env.NEXTAUTH_SECRET || "fallback_secret_for_development",
}

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }