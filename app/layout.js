import "./globals.css";

export const metadata = {
  title: "Commandes La Vie Saine",
  description: "Commandes des clients professionnels de la Boulangerie La Vie Saine",
  manifest: "/manifest.json",
  icons: { icon: "/logo-carre-192.png", apple: "/logo-carre.png" },
  appleWebApp: { capable: true, title: "La Vie Saine", statusBarStyle: "default" },
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
