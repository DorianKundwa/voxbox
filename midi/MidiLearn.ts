/**
 * MidiLearn — powered by the `webmidi` npm package.
 *
 * Provides:
 *  - useWebMidi()       React hook for MIDI status
 *  - useMidiLearn()     Knob MIDI-learn hook
 *  - Global CC routing  (channel-aware, fixes audit bug #9)
 */

"use client";

import { useEffect, useRef, useState, useCallback, useSyncExternalStore } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MidiMapping {
  cc:      number;
  channel: number;  // 1-16
}

type KnobCallback = (cc: number, value: number) => void;

// ── Module-level state (singleton across renders) ──────────────────────────

let _enabled    = false;
let _webmidi: any = null;   // lazy-loaded webmidi instance

const _mappings:  Record<string, MidiMapping>  = {};
const _callbacks: Record<string, KnobCallback> = {};
const _listeners: Set<() => void>              = new Set();
let   _learning:  string | null                = null;

// ── Store snapshot for useSyncExternalStore ───────────────────────────────

interface MidiState {
  enabled:  boolean;
  inputs:   string[];
  mappings: Record<string, MidiMapping>;
  learning: string | null;
}

const SERVER_SNAPSHOT: MidiState = {
  enabled:  false,
  inputs:   [],
  mappings: {},
  learning: null,
};

let _cachedSnapshot: MidiState = SERVER_SNAPSHOT;

function _updateSnapshot() {
  _cachedSnapshot = {
    enabled:  _enabled,
    inputs:   _webmidi?.inputs?.map((i: any) => i.name) ?? [],
    mappings: { ..._mappings },
    learning: _learning,
  };
}

function _notify() {
  _updateSnapshot();
  _listeners.forEach(fn => fn());
}

function _getSnapshot(): MidiState {
  return _cachedSnapshot;
}

function _getServerSnapshot(): MidiState {
  return SERVER_SNAPSHOT;
}

// ── Init: lazy-load webmidi and start listening ───────────────────────────

async function _initWebMidi() {
  if (_webmidi || typeof window === "undefined") return;
  try {
    const { WebMidi } = await import("webmidi");
    await WebMidi.enable({ sysex: false });

    _webmidi = WebMidi;
    _enabled = true;
    _notify();

    // Listen to all inputs for CC messages, channel-aware
    WebMidi.inputs.forEach(input => _attachInput(input));

    // Re-attach when inputs connect later
    WebMidi.addListener("connected", ({ port }: any) => {
      if (port.type === "input") _attachInput(port);
      _notify();
    });
    WebMidi.addListener("disconnected", () => _notify());
  } catch (err) {
    console.warn("[MidiLearn] webmidi init failed:", err);
    _enabled = false;
    _notify();
  }
}

function _attachInput(input: any) {
  // Listen on all channels
  for (let ch = 1; ch <= 16; ch++) {
    input.addListener("controlchange", (e: any) => {
      const cc      = e.controller.number as number;
      const value   = e.rawValue      as number;
      const channel = e.message.channel as number;

      // --- MIDI Learn capture ---
      if (_learning) {
        const id = _learning;
        _mappings[id]  = { cc, channel };
        _learning      = null;
        _notify();
        // Immediately route this value too
        _callbacks[id]?.(cc, value);
        return;
      }

      // --- Normal routing: channel-aware (fixes audit bug #9) ---
      Object.entries(_mappings).forEach(([knobId, mapping]) => {
        if (mapping.cc === cc && mapping.channel === channel) {
          _callbacks[knobId]?.(cc, value);
        }
      });
    }, { channels: ch });
  }
}

// ── Public hooks ──────────────────────────────────────────────────────────

/** Initialise WebMIDI and expose connection state. */
export function useWebMidi() {
  const state = useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    _getSnapshot,
    _getServerSnapshot
  );

  useEffect(() => { _initWebMidi(); }, []);
  return state;
}

/** Per-knob hook: registers a callback and exposes learn/clear helpers. */
export function useMidiLearn() {
  const state = useSyncExternalStore(
    (cb) => { _listeners.add(cb); return () => _listeners.delete(cb); },
    _getSnapshot,
    _getServerSnapshot
  );

  useEffect(() => { _initWebMidi(); }, []);

  const learnKnob = useCallback((id: string, cb: KnobCallback) => {
    _callbacks[id] = cb;
    _learning      = id;
    _notify();
  }, []);

  const clearMapping = useCallback((id: string) => {
    delete _mappings[id];
    delete _callbacks[id];
    _notify();
  }, []);

  return {
    isLearning:   state.learning,
    mappings:     state.mappings,
    enabled:      state.enabled,
    learnKnob,
    clearMapping,
  };
}
