"use client";

import { TallerPage } from "@/components/taller-page";
import { MODISTA_CONFIG } from "@/lib/taller-config";

export default function ModistaPage() {
  return <TallerPage config={MODISTA_CONFIG} />;
}
