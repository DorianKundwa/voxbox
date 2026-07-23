"use client";

/**
 * ChainSync — invisible component that keeps the AudioEngine in sync
 * with the chain store at all times when in "processed" monitor mode.
 *
 * Without this, knob changes and module toggles only update the store
 * but never reach the AudioEngine until the next play() call.
 *
 * Mount once at the page level (already done in app/page.tsx).
 */

import { useEffect, useRef } from "react";
import { useChainStore } from "@/store/chainStore";
import { useAudioStore } from "@/store/audioStore";
import { getAudioEngine } from "@/engine/AudioEngine";

export function ChainSync() {
  const modules     = useChainStore((s) => s.modules);
  const monitorMode = useAudioStore((s) => s.monitorMode);

  // Track if the engine has been initialised (don't call applyChain before init)
  const hasInitRef = useRef(false);

  useEffect(() => {
    const engine = getAudioEngine();

    // Only apply if we're in processed mode and engine context exists
    if (monitorMode !== "processed") return;

    const ctx = engine.getContext();
    if (!ctx) {
      // Engine not initialised yet — init it so subsequent loads work
      engine.init().then(() => {
        hasInitRef.current = true;
        engine.applyChain(modules);
      }).catch(() => {});
      return;
    }

    hasInitRef.current = true;
    engine.applyChain(modules);
  }, [modules, monitorMode]);

  return null;  // renders nothing
}
