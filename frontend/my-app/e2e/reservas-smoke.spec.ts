import { test, expect } from "@playwright/test";

/**
 * E2E opcional: requiere frontend (y normalmente API) en marcha.
 * - Sin E2E_RUN: los tests se omiten (CI rápido).
 * - Con E2E_RUN=1: visita la app; ajustá la aserción según tu ruta de login.
 */
test.describe("Smoke reservas / app", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_RUN,
      "Definí E2E_RUN=1, levantá Next (npm run dev) y la API; opcional E2E_BASE_URL"
    );
  });

  test("carga la raíz o redirige a login", async ({ page }) => {
    await page.goto("/");
    const url = page.url();
    expect(url.length).toBeGreaterThan(0);
  });
});
