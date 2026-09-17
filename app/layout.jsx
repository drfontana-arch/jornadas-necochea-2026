import "./globals.css";

export const metadata = {
  title: "Jornadas Necochea 2026 — Sistema interno",
  description: "Sorteo, auditoría y supervisión de las Jornadas Deportivas Interdepartamentales — Necochea 2026",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
