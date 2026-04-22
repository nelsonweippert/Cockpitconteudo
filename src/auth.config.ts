import type { NextAuthConfig } from "next-auth"

// Config leve — sem DB, usada no middleware (edge runtime)
export const authConfig: NextAuthConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user
      const isAuthRoute = nextUrl.pathname.startsWith("/login")

      if (isAuthRoute) return true
      if (!isLoggedIn) return false
      return true
    },
  },
  providers: [],
}
