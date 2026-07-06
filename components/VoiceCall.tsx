"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Loader2, Volume2 } from "lucide-react";

type CallState = "idle" | "connecting" | "live" | "ended" | "error";

// Hard cap on call length to bound cost — realtime audio is billed per minute.
// Overridable per-env; defaults to 5 minutes.
const MAX_CALL_SECONDS = Number(process.env.NEXT_PUBLIC_VOICE_MAX_SECONDS) || 300;

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.max(0, sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Browser → OpenAI Realtime voice call over WebRTC ("call over internet").
// The mic streams up, the agent's voice plays back — no phone number. Grounded
// server-side in the business context via /api/chat/[memberId]/voice.
export function VoiceCall({
  memberId,
  memberName,
  onClose,
}: {
  memberId: string;
  memberName: string;
  onClose: () => void;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(MAX_CALL_SECONDS);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Tear down everything — safe to call multiple times.
  const hangUp = useCallback((next: CallState = "ended") => {
    micRef.current?.getTracks().forEach((t) => t.stop());
    micRef.current = null;
    if (pcRef.current) {
      pcRef.current.getSenders().forEach((s) => s.track?.stop());
      pcRef.current.close();
      pcRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }
    setState((s) => (s === "error" ? s : next));
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setState("connecting");
    try {
      // 1. Mint an ephemeral, business-grounded Realtime session server-side.
      const tokenRes = await fetch(`/api/chat/${memberId}/voice`, { method: "POST" });
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({}));
        throw new Error(
          body.error === "voice_unavailable"
            ? "Voice calling isn't set up for this business yet."
            : body.error === "upgrade_required"
            ? "Voice calling isn't available for this business. Try the chat instead."
            : body.error === "rate_limited"
            ? "This business has reached its voice-call limit for now. Try the chat instead."
            : "Couldn't start the call. Please try again."
        );
      }
      const { client_secret, model } = await tokenRes.json();

      // 2. WebRTC peer connection straight to OpenAI.
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // Remote audio (the agent's voice).
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          audioRef.current.play().catch(() => {});
        }
      };

      pc.onconnectionstatechange = () => {
        const cs = pc.connectionState;
        if (cs === "connected") setState("live");
        else if (cs === "failed" || cs === "disconnected") hangUp("ended");
      };

      // 3. Mic → up.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // Data channel (Realtime events; not strictly needed for basic voice).
      pc.createDataChannel("oai-events");

      // 4. SDP offer/answer handshake with OpenAI, authed by the ephemeral key.
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(model)}`,
        {
          method: "POST",
          body: offer.sdp,
          headers: {
            Authorization: `Bearer ${client_secret}`,
            "Content-Type": "application/sdp",
          },
        }
      );
      if (!sdpRes.ok) throw new Error("Couldn't connect the call.");
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
      // connectionstatechange flips us to "live".
    } catch (e) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access is needed to call. Enable it and try again."
          : e instanceof Error
          ? e.message
          : "Something went wrong.";
      setError(msg);
      setState("error");
      hangUp("error");
    }
  }, [memberId, hangUp]);

  // Auto-start when the panel mounts.
  useEffect(() => {
    start();
    return () => hangUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Length cap — tick down once live, auto-hang up at zero to bound cost.
  useEffect(() => {
    if (state !== "live") return;
    const t = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(t);
          hangUp("ended");
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [state, hangUp]);

  function toggleMute() {
    const tracks = micRef.current?.getAudioTracks() ?? [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  const connecting = state === "connecting" || state === "idle";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-8 text-center">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} autoPlay />

      {/* Status orb */}
      <div className="relative flex h-28 w-28 items-center justify-center">
        {state === "live" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-indigo-400/40" />
        )}
        <div
          className={
            "relative flex h-24 w-24 items-center justify-center rounded-full text-white " +
            (state === "live"
              ? "bg-gradient-to-br from-indigo-500 to-violet-600"
              : state === "error"
              ? "bg-stone-400"
              : "bg-gradient-to-br from-indigo-400 to-violet-500")
          }
        >
          {connecting ? (
            <Loader2 className="h-9 w-9 animate-spin" />
          ) : state === "live" ? (
            <Volume2 className="h-9 w-9" />
          ) : (
            <Phone className="h-9 w-9" />
          )}
        </div>
      </div>

      <div>
        <p className="text-base font-semibold text-stone-900">{memberName}</p>
        <p className="mt-0.5 text-sm text-stone-500">
          {state === "live"
            ? muted
              ? "Muted — they can't hear you"
              : "Connected — start talking"
            : connecting
            ? "Connecting…"
            : state === "error"
            ? error ?? "Call failed"
            : "Call ended"}
        </p>
        {state === "live" && (
          <p className={"mt-1 text-xs font-medium " + (remaining <= 30 ? "text-rose-500" : "text-stone-400")}>
            {fmt(remaining)} left
            {remaining <= 30 ? " — wrapping up" : ""}
          </p>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {state === "live" && (
          <button
            onClick={toggleMute}
            className={
              "inline-flex h-12 w-12 items-center justify-center rounded-full border transition " +
              (muted
                ? "border-stone-300 bg-stone-100 text-stone-700"
                : "border-stone-200 bg-white text-stone-700 hover:bg-stone-50")
            }
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
        )}

        {state === "error" || state === "ended" ? (
          <button
            onClick={start}
            className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700"
          >
            <Phone className="h-4 w-4" /> Call again
          </button>
        ) : (
          <button
            onClick={() => {
              hangUp("ended");
              onClose();
            }}
            className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-rose-600 text-white transition hover:bg-rose-700"
            aria-label="End call"
          >
            <PhoneOff className="h-5 w-5" />
          </button>
        )}
      </div>

      {(state === "error" || state === "ended") && (
        <button
          onClick={onClose}
          className="text-xs font-medium text-stone-400 hover:text-stone-600"
        >
          Close
        </button>
      )}
    </div>
  );
}
