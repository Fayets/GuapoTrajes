"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  GUAPO_PENDING_BARCODE_KEY,
  GUAPO_BARCODE_SCAN_EVENT,
  isPlausibleProductBarcode,
  shouldIgnoreBarcodeTarget,
  type GuapoBarcodeScanDetail,
} from "@/lib/barcode-scan";

const BUFFER_MAX = 64;

/**
 * Captura entrada tipo lectora HID (caracteres + Enter), guarda el código y navega a Presupuestos.
 * No actúa si el foco está en input/textarea/select o [data-no-barcode].
 */
export function useBarcodeScanToPresupuestos() {
  const router = useRouter();
  const pathname = usePathname();
  const bufferRef = useRef("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      if (shouldIgnoreBarcodeTarget(e.target)) {
        bufferRef.current = "";
        return;
      }

      if (e.key === "Escape") {
        bufferRef.current = "";
        return;
      }

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (!code || !isPlausibleProductBarcode(code)) return;
        e.preventDefault();
        try {
          sessionStorage.setItem(GUAPO_PENDING_BARCODE_KEY, code);
        } catch {
          /* ignore quota / private mode */
        }
        window.dispatchEvent(
          new CustomEvent<GuapoBarcodeScanDetail>(GUAPO_BARCODE_SCAN_EVENT, {
            detail: { code },
          })
        );
        if (pathname !== "/presupuestos") {
          router.push("/presupuestos");
        }
        return;
      }

      if (e.key.length === 1) {
        const ch = e.key;
        if (ch >= " " && ch <= "~") {
          bufferRef.current += ch;
          if (bufferRef.current.length > BUFFER_MAX) {
            bufferRef.current = bufferRef.current.slice(-BUFFER_MAX);
          }
        }
      }
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [router, pathname]);
}
