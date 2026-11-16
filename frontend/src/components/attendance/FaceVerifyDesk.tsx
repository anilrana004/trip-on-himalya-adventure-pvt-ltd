"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, formatApiError } from "@/lib/api";
import { descriptorFromVideo, ensureFaceApi, snapshotFromVideo } from "@/lib/faceRecognition";
import { WebcamCapture } from "@/components/attendance/WebcamCapture";

type RosterItem = {
  userId: string;
  fullName: string | null;
  email: string | null;
  role: string;
  enrolled: boolean;
  enrolledAt?: string | null;
  sampleCount: number;
};

type VerifyResult = {
  id: string;
  subjectUserId: string | null;
  matchedUserId: string | null;
  matchedFullName: string | null;
  matchedEmail: string | null;
  purpose: string;
  result: string;
  score: number | null;
  threshold: number;
  createdAt: string;
};

type LogRow = {
  id: string;
  subjectUserId: string | null;
  subjectName: string | null;
  matchedUserId: string | null;
  matchedName: string | null;
  verifiedByName: string | null;
  purpose: string;
  result: string;
  score: number | null;
  createdAt: string;
};

type Mode = "enroll" | "verify" | "identify";

function indiaToday() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function resultClass(result: string) {
  if (result === "MATCH") return "bg-emerald-50 text-emerald-800";
  if (result === "NO_MATCH" || result === "NO_TEMPLATE") return "bg-rose-50 text-rose-800";
  if (result === "AMBIGUOUS") return "bg-amber-50 text-amber-900";
  return "bg-slate-100 text-slate-600";
}

export function FaceVerifyDesk({ company = false }: { company?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [roster, setRoster] = useState<RosterItem[]>([]);
  const [userId, setUserId] = useState("");
  const [mode, setMode] = useState<Mode>("verify");
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<VerifyResult | null>(null);
  const [logDay, setLogDay] = useState(() => indiaToday());
  const [log, setLog] = useState<LogRow[]>([]);
  const [enrollSamples, setEnrollSamples] = useState<number[][]>([]);

  const loadRoster = useCallback(() => {
    api
      .listFaceRoster()
      .then((rows) => {
        setRoster(rows);
        setUserId((current) => current || rows[0]?.userId || "");
        setError(null);
      })
      .catch((e: unknown) => setError(formatApiError(e, "Could not load face roster")));
  }, []);

  const loadLog = useCallback(() => {
    api
      .listFaceVerificationLog(logDay || undefined)
      .then(setLog)
      .catch((e: unknown) => setError(formatApiError(e, "Could not load verification log")));
  }, [logDay]);

  useEffect(() => {
    loadRoster();
  }, [loadRoster]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  useEffect(() => {
    ensureFaceApi()
      .then(() => {
        setModelsReady(true);
        setStatus("Face models ready.");
      })
      .catch((e: unknown) => {
        setModelsReady(false);
        setError(e instanceof Error ? e.message : "Could not load face models");
      });
  }, []);

  const selected = roster.find((r) => r.userId === userId) ?? null;
  const enrolledCount = roster.filter((r) => r.enrolled).length;

  async function captureDescriptor() {
    const video = videoRef.current;
    if (!video || !cameraReady) {
      throw new Error("Start the webcam first");
    }
    if (!modelsReady) {
      throw new Error("Face models are still loading");
    }
    return descriptorFromVideo(video);
  }

  async function captureSnapshot() {
    const video = videoRef.current;
    if (!video) return undefined;
    return snapshotFromVideo(video);
  }

  async function addEnrollSample() {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const descriptor = await captureDescriptor();
      setEnrollSamples((prev) => [...prev, descriptor].slice(0, 5));
      setStatus(`Captured sample ${(enrollSamples.length + 1)}. Aim for 3 samples, then Save enrollment.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : formatApiError(e, "Could not capture face"));
    } finally {
      setBusy(false);
    }
  }

  async function saveEnrollment() {
    if (!userId) return;
    if (enrollSamples.length < 2) {
      setError("Capture at least 2 face samples before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const snapshot = await captureSnapshot();
      await api.enrollFace({
        userId,
        descriptors: enrollSamples,
        snapshotJpegBase64: snapshot,
      });
      setEnrollSamples([]);
      setStatus("Enrollment saved. That person can be verified at the desk.");
      loadRoster();
    } catch (e) {
      setError(formatApiError(e, "Could not save enrollment"));
    } finally {
      setBusy(false);
    }
  }

  async function clearEnrollment() {
    if (!userId || !selected?.enrolled) return;
    if (!confirm(`Clear face enrollment for ${selected.fullName || selected.email}?`)) return;
    setBusy(true);
    try {
      await api.clearFaceEnrollment(userId);
      setStatus("Enrollment cleared.");
      loadRoster();
    } catch (e) {
      setError(formatApiError(e, "Could not clear enrollment"));
    } finally {
      setBusy(false);
    }
  }

  async function runVerify() {
    setBusy(true);
    setError(null);
    setLastResult(null);
    try {
      const descriptor = await captureDescriptor();
      const snapshot = await captureSnapshot();
      const result = await api.verifyFace({
        subjectUserId: mode === "identify" ? undefined : userId || undefined,
        descriptor,
        purpose: mode === "identify" ? "IDENTIFY" : "DESK_CHECK",
        snapshotJpegBase64: snapshot,
      });
      setLastResult(result);
      setStatus(
        result.result === "MATCH"
          ? `Match: ${result.matchedFullName || "enrolled person"}`
          : `Result: ${result.result}`,
      );
      loadLog();
    } catch (e) {
      setError(e instanceof Error && !("status" in e)
        ? e.message
        : formatApiError(e, "Verification failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Webcam</div>
              <p className="text-xs text-slate-500">
                {company
                  ? "Admin/CEO: enroll and verify any office Sales, Ops, or Manager."
                  : "Manager: enroll and verify yourself and people who report to you."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCameraOn((v) => !v)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {cameraOn ? "Stop camera" : "Start camera"}
            </button>
          </div>
          <WebcamCapture
            videoRef={videoRef}
            active={cameraOn}
            onReadyChange={setCameraReady}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {(["enroll", "verify", "identify"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m);
                  setEnrollSamples([]);
                  setLastResult(null);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  mode === m
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 text-slate-700 hover:bg-slate-50"
                }`}
              >
                {m === "enroll" ? "Enroll" : m === "verify" ? "Verify person" : "Identify anyone"}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Office roster</div>
              <p className="text-xs text-slate-500">
                {enrolledCount} enrolled · {roster.length} in scope
              </p>
            </div>
            <button
              type="button"
              onClick={loadRoster}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
          </div>

          <label className="block text-xs font-medium text-slate-600">
            Person
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                setEnrollSamples([]);
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            >
              {roster.length === 0 && <option value="">No office people in scope</option>}
              {roster.map((row) => (
                <option key={row.userId} value={row.userId}>
                  {row.fullName || row.email} · {row.role}
                  {row.enrolled ? " · enrolled" : " · not enrolled"}
                </option>
              ))}
            </select>
          </label>

          {selected && (
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</div>
                <div className="mt-0.5 font-semibold text-slate-900">
                  {selected.enrolled ? "Enrolled" : "Not enrolled"}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Samples</div>
                <div className="mt-0.5 font-semibold tabular-nums text-slate-900">
                  {selected.sampleCount || 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Updated</div>
                <div className="mt-0.5 text-xs font-semibold text-slate-900">
                  {selected.enrolledAt ? formatWhen(selected.enrolledAt) : "—"}
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {mode === "enroll" && (
              <>
                <p className="text-xs text-slate-500">
                  Capture 2–5 samples of the same person (slightly different angles), then save.
                  Current buffer: {enrollSamples.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy || !cameraReady}
                    onClick={() => void addEnrollSample()}
                    className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? "Working…" : "Capture sample"}
                  </button>
                  <button
                    type="button"
                    disabled={busy || enrollSamples.length < 2}
                    onClick={() => void saveEnrollment()}
                    className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Save enrollment
                  </button>
                  <button
                    type="button"
                    disabled={busy || enrollSamples.length === 0}
                    onClick={() => setEnrollSamples([])}
                    className="rounded-md border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Clear samples
                  </button>
                  {selected?.enrolled && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void clearEnrollment()}
                      className="rounded-md border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Clear enrollment
                    </button>
                  )}
                </div>
              </>
            )}

            {mode === "verify" && (
              <>
                <p className="text-xs text-slate-500">
                  1:1 desk check — the face in the camera must match the selected enrolled person.
                </p>
                <button
                  type="button"
                  disabled={busy || !cameraReady || !selected?.enrolled}
                  onClick={() => void runVerify()}
                  className="rounded-md bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {busy ? "Checking…" : "Verify against selected"}
                </button>
                {selected && !selected.enrolled && (
                  <p className="text-xs text-amber-700">Enroll this person first.</p>
                )}
              </>
            )}

            {mode === "identify" && (
              <>
                <p className="text-xs text-slate-500">
                  1:N identify — match the camera face against everyone enrolled in your scope.
                </p>
                <button
                  type="button"
                  disabled={busy || !cameraReady || enrolledCount === 0}
                  onClick={() => void runVerify()}
                  className="rounded-md bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {busy ? "Checking…" : "Identify who this is"}
                </button>
              </>
            )}
          </div>

          {status && <p className="mt-3 text-sm text-slate-700">{status}</p>}
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          {lastResult && (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${resultClass(lastResult.result)}`}>
                  {lastResult.result}
                </span>
                <span className="text-sm font-semibold text-slate-900">
                  {lastResult.matchedFullName || selected?.fullName || "—"}
                </span>
              </div>
              <div className="mt-1 text-xs text-slate-500">
                Score {lastResult.score?.toFixed(3) ?? "—"} · threshold {lastResult.threshold.toFixed(2)} ·{" "}
                {formatWhen(lastResult.createdAt)}
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">Verification log</div>
            <p className="text-xs text-slate-500">Every MATCH / NO_MATCH for the India day — who checked whom.</p>
          </div>
          <input
            type="date"
            value={logDay}
            onChange={(e) => setLogDay(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700"
          />
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">When</th>
              <th className="px-3 py-2.5 font-medium">Result</th>
              <th className="px-3 py-2.5 font-medium">Matched</th>
              <th className="px-3 py-2.5 font-medium">Purpose</th>
              <th className="px-3 py-2.5 font-medium">By</th>
              <th className="px-4 py-2.5 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No face checks on this day. Enroll office staff, then run Verify or Identify.
                </td>
              </tr>
            )}
            {log.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-slate-700">{formatWhen(row.createdAt)}</td>
                <td className="px-3 py-2.5">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${resultClass(row.result)}`}>
                    {row.result}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-900">
                  {row.matchedName || row.subjectName || "—"}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{row.purpose}</td>
                <td className="px-3 py-2.5 text-slate-600">{row.verifiedByName || "—"}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-900">
                  {row.score != null ? row.score.toFixed(3) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
