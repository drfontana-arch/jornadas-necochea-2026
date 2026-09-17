// Usa Web Crypto (disponible tanto en el runtime Edge del middleware como
// en el runtime Node.js moderno de los route handlers de Vercel) — evitamos
// a propósito cualquier import de "node:crypto", que rompe el bundling del
// middleware en Edge.
export async function hashToken(passphrase, secret) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error("Web Crypto (crypto.subtle) no está disponible en este runtime.");
  }
  const enc = new TextEncoder();
  const data = enc.encode(`${passphrase}::${secret}`);
  const digest = await subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const AUTH_COOKIE = "jornadas_auth";
