import "./globals.css";

export const metadata = {
  title: "Commandes La Vie Saine",
  description: "Commandes des clients professionnels de la Boulangerie La Vie Saine",
  manifest: "/manifest.json",
};
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#2f6b3a" };

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
