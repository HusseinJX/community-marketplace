"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Mic, MicOff, Loader2, Volume2 } from "lucide-react";

type CallState = "idle" | "connecting" | "live" | "ended" | "error";

// Hard cap on call length to bound cost — realtime audio is billed per minute.
// Overridable per-env; defaults to 5 minutes.
const MAX_CALL_SECONDS = Number(process.env.NEXT_PUBLIC_VOICE_MAX_SECONDS) || 300;

// How long a transient "disconnected" gets to recover before we call it a real
// drop. ICE consent checks run every ~5s, so this spans a couple of them —
// long enough to ride out a blip, short enough that a truly dead call doesn't
// leave the member listening to silence.
const RECONNECT_GRACE_MS = 12_000;

// Backstop for the agent's own hangup: we normally wait for the goodbye audio to
// drain (output_audio_buffer.stopped), but if that event never lands we must not
// leave the member sitting on a call the agent thinks it already ended.
const END_CALL_MAX_WAIT_MS = 10_000;

// STUN. Without this the peer connection only ever gathers HOST candidates, so
// behind any NAT (i.e. essentially every real user) there is no valid path to
// OpenAI's servers. The call would appear to connect, run on borrowed time, and
// die at the first ICE consent check ~30-45s in with no candidate to fall back
// on — silently, mid-sentence. `new RTCPeerConnection()` with no config is the
// single most expensive default in this file.
const STUN_URLS = (process.env.NEXT_PUBLIC_STUN_URLS ||
  "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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
  tokenUrl,
  tokenBody,
  onTranscript,
  openWithGreeting = false,
}: {
  memberId?: string;
  memberName: string;
  onClose: () => void;
  // Override the session-minting endpoint. Defaults to the business voice agent.
  // The onboarding interview passes /api/onboard/voice.
  tokenUrl?: string;
  // Optional JSON body to POST when minting (e.g. { name, kind } for onboarding).
  tokenBody?: Record<string, unknown>;
  // Streams each completed transcript line (user + agent) as it lands, so a
  // parent can persist the conversation (used by the onboarding interview).
  onTranscript?: (m: { role: "user" | "assistant"; content: string }) => void;
  // Make the AGENT talk first. Realtime generates nothing until a response is
  // requested — with server VAD it only replies after it hears you — so without
  // this the agent sits silent until the member speaks, and any "open with X"
  // instruction is dead letter. The onboarding interview needs it (its whole
  // design is the agent opening with what it researched). The business agent
  // leaves it off: a customer who dialled in expects to talk first.
  openWithGreeting?: boolean;
}) {
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(MAX_CALL_SECONDS);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Pending "did disconnected recover?" timer — see onconnectionstatechange.
  const dropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The agent asked to hang up (end_call) and we're letting its goodbye play out.
  const endingRef = useRef(false);
  // onClose as a ref: the data-channel handler is created once inside start(),
  // so closing over the prop directly would pin the first render's copy.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // The agent said goodbye and its audio has drained — end the call for real and
  // hand off to the parent (which persists the interview). Idempotent: whichever
  // of output_audio_buffer.stopped or the safety timer lands first wins.
  const concludeRef = useRef<() => void>(() => {});

  // Tear down everything — safe to call multiple times.
  const hangUp = useCallback((next: CallState = "ended") => {
    if (dropTimerRef.current) {
      clearTimeout(dropTimerRef.current);
      dropTimerRef.current = null;
    }
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

  useEffect(() => {
    concludeRef.current = () => {
      if (!endingRef.current) return;
      endingRef.current = false;
      hangUp("ended");
      onCloseRef.current();
    };
  }, [hangUp]);

  const start = useCallback(async () => {
    setError(null);
    setState("connecting");
    try {
      // 1. Mint an ephemeral, grounded Realtime session server-side.
      const url = tokenUrl ?? `/api/chat/${memberId}/voice`;
      const tokenRes = await fetch(url, {
        method: "POST",
        headers: tokenBody ? { "Content-Type": "application/json" } : undefined,
        body: tokenBody ? JSON.stringify(tokenBody) : undefined,
      });
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
      // One entry per URL: Firefox is fussier than Chrome about several urls
      // packed into a single iceServers entry.
      const pc = new RTCPeerConnection({ iceServers: STUN_URLS.map((u) => ({ urls: u })) });
      pcRef.current = pc;

      // Remote audio (the agent's voice).
      pc.ontrack = (e) => {
        if (audioRef.current) {
          audioRef.current.srcObject = e.streams[0];
          audioRef.current.play().catch(() => {});
        }
      };

      // "disconnected" is TRANSIENT, not terminal: it only means no packets have
      // arrived recently — a wifi blip, a route change, or a slow ICE consent
      // check — and connections routinely recover from it on their own. We used
      // to tear the call down the instant we saw it, which killed healthy calls
      // mid-sentence after ~30s and looked to the member like the agent hung up
      // on them. Only "failed" is terminal; give "disconnected" a chance to come
      // back, and hang up only if it doesn't.
      pc.onconnectionstatechange = () => {
        const cs = pc.connectionState;
        if (cs === "connected") {
          if (dropTimerRef.current) {
            clearTimeout(dropTimerRef.current);
            dropTimerRef.current = null;
          }
          setState("live");
        } else if (cs === "failed") {
          console.error("[VoiceCall] connection failed, ice:", pc.iceConnectionState);
          hangUp("ended");
        } else if (cs === "disconnected") {
          if (dropTimerRef.current) return; // already waiting it out
          dropTimerRef.current = setTimeout(() => {
            dropTimerRef.current = null;
            // Still not back — now it's a real drop.
            if (pcRef.current && pcRef.current.connectionState !== "connected") {
              console.error("[VoiceCall] drop didn't recover, ice:", pcRef.current.iceConnectionState);
              hangUp("ended");
            }
          }, RECONNECT_GRACE_MS);
        }
      };

      // 3. Mic → up.
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;
      mic.getTracks().forEach((t) => pc.addTrack(t, mic));

      // Data channel — Realtime server events. Used to harvest the running
      // transcript (both sides) so the onboarding interview can be saved.
      //
      // The handler is attached unconditionally: when the session errors, OpenAI
      // says so on this channel, and a swallowed error looks exactly like the
      // agent going quiet and the call dying for no reason. Transcript harvesting
      // is the optional part, not the listening.
      const dc = pc.createDataChannel("oai-events");
      // Ask the agent to speak first. Nothing is generated until a response is
      // requested, so without this the session just listens (see openWithGreeting).
      if (openWithGreeting) {
        dc.onopen = () => {
          try {
            dc.send(JSON.stringify({ type: "response.create" }));
          } catch (err) {
            console.error("[VoiceCall] couldn't request opening greeting", err);
          }
        };
      }
      dc.onmessage = (e) => {
        let evt: { type?: string; error?: unknown; transcript?: unknown };
        try {
          evt = JSON.parse(e.data);
        } catch {
          return; // genuinely non-JSON keepalive frame
        }
        // DEV ONLY: trace the session's event stream, minus the per-frame audio
        // deltas that would drown it. An agent that answers twice and then goes
        // quiet is doing SOMETHING here; this shows what.
        if (process.env.NODE_ENV === "development" && evt.type && !evt.type.includes("delta")) {
          const r = (evt as { response?: { status?: string; status_details?: unknown } }).response;
          console.log(
            "[VoiceCall:evt]",
            evt.type,
            r?.status ? `status=${r.status}` : "",
            r?.status_details ? JSON.stringify(r.status_details) : ""
          );
        }
        // The agent decided the interview is complete (see the end_call tool).
        // Don't hang up yet — its goodbye is still playing. Mark it and wait for
        // the audio to drain, so the call ends on a finished sentence.
        if (
          evt.type === "response.function_call_arguments.done" &&
          (evt as { name?: string }).name === "end_call"
        ) {
          endingRef.current = true;
          // Put the wants/offers into the transcript verbatim. The spoken summary
          // may be paraphrased or mis-transcribed, and this pair is the whole
          // point of the call — it's what the connector turns into the needs and
          // offers vectors it matches on. Hand it over as text rather than hoping
          // whisper caught it.
          try {
            const args = JSON.parse((evt as { arguments?: string }).arguments || "{}");
            const wants: string[] = args.wants || [];
            const offers: string[] = args.offers || [];
            const lines = [
              wants.length ? `What they WANT from the community: ${wants.join("; ")}` : "",
              offers.length ? `What they OFFER the community: ${offers.join("; ")}` : "",
            ].filter(Boolean);
            if (lines.length && onTranscript) {
              onTranscript({ role: "assistant", content: lines.join(". ") });
            }
          } catch {
            /* the summary is a bonus; never block the hangup on parsing it */
          }
          // Safety net: if the audio-drained event never arrives, don't strand
          // them on a dead call.
          setTimeout(() => concludeRef.current(), END_CALL_MAX_WAIT_MS);
        }
        // Goodbye finished playing — now it's safe to hang up.
        if (evt.type === "output_audio_buffer.stopped" && endingRef.current) {
          concludeRef.current();
        }
        // The session told us something went wrong. Don't die quietly.
        if (evt.type === "error" || evt.type === "response.done") {
          const err =
            evt.type === "error"
              ? evt.error
              : (evt as { response?: { status?: string; status_details?: unknown } }).response
                  ?.status === "failed"
              ? (evt as { response?: { status_details?: unknown } }).response?.status_details
              : null;
          if (err) console.error("[VoiceCall] realtime session error", err);
        }
        if (!onTranscript) return;
        // The customer's speech, transcribed by whisper.
        if (
          evt.type === "conversation.item.input_audio_transcription.completed" &&
          typeof evt.transcript === "string" &&
          evt.transcript.trim()
        ) {
          onTranscript({ role: "user", content: evt.transcript.trim() });
        }
        // The agent's spoken reply, transcribed.
        else if (
          evt.type === "response.audio_transcript.done" &&
          typeof evt.transcript === "string" &&
          evt.transcript.trim()
        ) {
          onTranscript({ role: "assistant", content: evt.transcript.trim() });
        }
      };

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
  }, [memberId, tokenUrl, tokenBody, onTranscript, hangUp, openWithGreeting]);

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
