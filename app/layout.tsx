import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Mhiru — Tu red de apoyo en momentos de crisis",
  description: "Mhiru  activa, gestiona y coordina las redes de personas y sus recursos con IA para que no las personas no enfrenten las crisis en soledad.",
  keywords: ["red de apoyo", "crisis de salud", "acompañamiento emocional", "coordinación logística", "agente IA", "cuidadores", "salud familiar"],
  icons: {
    icon: "/LOGO_CIRCL_2.svg",
    apple: "/LOGO_CIRCL_2.svg",
  },
  openGraph: {
    type: "website",
    url: "https://www.hellomhiru.com",
    title: "Mhiru — Tu red de apoyo en momentos de crisis",
    description: "Un agente de IA que activa, gestiona y coordina tu red de personas y recursos para que no enfrentes solo tu crisis.",
    images: [
      {
        url: "https://www.hellomhiru.com/LOGO_CIRCL_2.svg",
        alt: "Mhiru",
      },
    ],
    locale: "es_AR",
    siteName: "Mhiru",
  },
  twitter: {
    card: "summary",
    title: "Mhiru — Tu red de apoyo en momentos de crisis",
    description: "Un agente de IA que activa, gestiona y coordina tu red de personas y recursos para que no enfrentes solo tu crisis.",
    images: ["https://www.hellomhiru.com/LOGO_CIRCL_2.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${plusJakartaSans.variable} h-full antialiased`}
    >
      <body className={`${plusJakartaSans.className} min-h-full flex flex-col`}>{children}</body>
    </html>
  );
}
