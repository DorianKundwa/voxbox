"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type LearnCallback = (cc: number, value: number) => void;

interface MidiMapping {
  cc: number;
  channel: number;
}

const STORAGE_KEY = "voxbox-midi-mappings";

function loadMappings(): Record<string, MidiMapping> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveMappings(m: Record<string, MidiMapping>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(m));
}

// Global MIDI state (shared across components)
let globalMappings: Record<string, MidiMapping> = {};
let globalCallbacks: Record<string, LearnCallback> = {};
let learningKnobId: string | null = null;
let learningCallback: LearnCallback | null = null;
let listeners: Array<() => void> = [];

function notifyListeners() {
  listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  globalMappings = loadMappings();

  (navigator as any).requestMIDIAccess?.({ sysex: false }).then(
    (access: any) => {
      const setupInput = (input: any) => {
        input.onmidimessage = (ev: any) => {
          const [status, cc, value] = ev.data as [number, number, number];
          const isCC = (status & 0xf0) === 0xb0;
          if (!isCC) return;

          const channel = status & 0x0f;

          // Learning mode
          if (learningKnobId && learningCallback) {
            globalMappings[learningKnobId] = { cc, channel };
            saveMappings(globalMappings);
            globalCallbacks[learningKnobId] = learningCallback;
            learningCallback(cc, value);
            learningKnobId = null;
            learningCallback = null;
            notifyListeners();
            return;
          }

          // Route to mapped knobs
          Object.entries(globalMappings).forEach(([knobId, mapping]) => {
            if (mapping.cc === cc) {
              const cb = globalCallbacks[knobId];
              if (cb) cb(cc, value);
            }
          });
        };
      };

      access.inputs.forEach(setupInput);
      access.onstatechange = (e: any) => {
        if (e.port.type === "input" && e.port.state === "connected") {
          setupInput(e.port);
        }
      };
    },
    (err: Error) => {
      console.warn("WebMIDI not available:", err.message);
    }
  );
}

export function useMidiLearn() {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const fn = () => forceUpdate((n) => n + 1);
    listeners.push(fn);
    return () => { listeners = listeners.filter((l) => l !== fn); };
  }, []);

  const learnKnob = useCallback((id: string, cb: LearnCallback) => {
    if (learningKnobId === id) {
      // Cancel learning
      learningKnobId = null;
      learningCallback = null;
    } else {
      learningKnobId = id;
      learningCallback = cb;
      globalCallbacks[id] = cb;
    }
    notifyListeners();
  }, []);

  const clearMapping = useCallback((id: string) => {
    delete globalMappings[id];
    delete globalCallbacks[id];
    saveMappings(globalMappings);
    notifyListeners();
  }, []);

  return {
    mappings: globalMappings,
    isLearning: learningKnobId,
    learnKnob,
    clearMapping,
  };
}
