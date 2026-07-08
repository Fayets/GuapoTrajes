/** Envío a WhatsApp: en PC usa la app de escritorio ya abierta; en móvil wa.me. */

export function normalizarTelefonoWhatsapp(telefono?: string | null): string | null {
  if (!telefono) return null;
  let limpio = String(telefono).replace(/\D/g, "");
  if (!limpio) return null;
  limpio = limpio.replace(/^0+/, "");

  if (limpio.startsWith("54")) {
    if (!limpio.startsWith("549")) {
      limpio = `549${limpio.slice(2)}`;
    }
  } else {
    if (limpio.startsWith("9")) {
      limpio = limpio.slice(1);
    }
    limpio = `549${limpio}`;
  }

  return limpio;
}

function esDispositivoMovil(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}

/**
 * Abre el chat con el mensaje precargado.
 * En PC: protocolo whatsapp:// → enfoca WhatsApp Desktop (no abre pestaña nueva).
 * En móvil: wa.me.
 */
export function abrirWhatsAppEnvio(
  telefono: string,
  texto: string
): boolean {
  const phone = normalizarTelefonoWhatsapp(telefono);
  if (!phone) return false;

  const textEncoded = encodeURIComponent(texto);

  if (esDispositivoMovil()) {
    window.location.href = `https://wa.me/${phone}?text=${textEncoded}`;
    return true;
  }

  const desktopUrl = `whatsapp://send?phone=${phone}&text=${textEncoded}`;
  const link = document.createElement("a");
  link.href = desktopUrl;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}
