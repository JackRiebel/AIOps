import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AISessionProvider } from "@/contexts/AISessionContext";
import { WebSocketProvider } from "@/contexts/WebSocketContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { SetupCheck } from "@/components/SetupCheck";
import { ErrorBoundary } from "@/components/common/ErrorBoundary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lumen - Network Intelligence",
  description: "AI-powered network monitoring and incident correlation platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = localStorage.getItem('theme') || 'dark';
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider>
          <DemoModeProvider>
            <SetupCheck>
              <AuthProvider>
                <PermissionProvider>
                  <AISessionProvider>
                    <WebSocketProvider>
                      <ErrorBoundary name="RootLayout">
                        <ProtectedRoute>
                          {children}
                        </ProtectedRoute>
                      </ErrorBoundary>
                    </WebSocketProvider>
                  </AISessionProvider>
                </PermissionProvider>
              </AuthProvider>
            </SetupCheck>
          </DemoModeProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
