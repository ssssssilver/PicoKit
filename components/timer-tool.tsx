"use client";

import {
  History,
  Pause,
  Play,
  RotateCcw,
  Save,
  Timer,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { localeForLanguage } from "@/lib/i18n";

type TimerMode = "countdown" | "pomodoro" | "stopwatch";
type TimerRecord = {
  id: string;
  mode: TimerMode;
  seconds: number;
  completedAt: number;
};

const historyKey = "picokit:timer-history:v1";
const historyEvent = "picokit:timer-history-changed";
const serverHistory: TimerRecord[] = [];
let historyRaw: string | null | undefined;
let historySnapshot = serverHistory;

function readHistory() {
  try {
    const raw = window.localStorage.getItem(historyKey);
    if (raw === historyRaw) return historySnapshot;
    historyRaw = raw;
    const parsed = raw ? JSON.parse(raw) : [];
    historySnapshot = Array.isArray(parsed)
      ? parsed
          .filter(
            (item) =>
              item &&
              typeof item.seconds === "number" &&
              typeof item.completedAt === "number",
          )
          .slice(0, 10)
      : [];
    return historySnapshot;
  } catch {
    return serverHistory;
  }
}
function subscribeHistory(callback: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === historyKey) callback();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(historyEvent, callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(historyEvent, callback);
  };
}
function writeHistory(records: TimerRecord[]) {
  try {
    window.localStorage.setItem(
      historyKey,
      JSON.stringify(records.slice(0, 10)),
    );
    window.dispatchEvent(new Event(historyEvent));
  } catch {
    /* Timers still work without persistent history. */
  }
}

export function TimerTool() {
  const { pick, language } = useLanguage();
  const [mode, setMode] = useState<TimerMode>("countdown");
  const [duration, setDuration] = useState(300);
  const [remaining, setRemaining] = useState(300);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const endAtRef = useRef(0);
  const startedAtRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const history = useSyncExternalStore(
    subscribeHistory,
    readHistory,
    () => serverHistory,
  );

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      if (mode === "stopwatch") {
        setElapsed(Math.max(0, (Date.now() - startedAtRef.current) / 1000));
        return;
      }
      const next = Math.max(
        0,
        Math.ceil((endAtRef.current - Date.now()) / 1000),
      );
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        addRecord(mode, duration);
        playFinishedTone(audioContextRef.current);
      }
    }, 250);
    return () => window.clearInterval(timer);
  }, [duration, mode, running]);

  function selectMode(next: TimerMode) {
    setRunning(false);
    setMode(next);
    setElapsed(0);
    const nextDuration =
      next === "pomodoro" ? 25 * 60 : next === "countdown" ? 5 * 60 : 0;
    setDuration(nextDuration);
    setRemaining(nextDuration);
  }

  function start() {
    if (!audioContextRef.current) audioContextRef.current = new AudioContext();
    if (mode === "stopwatch")
      startedAtRef.current = Date.now() - elapsed * 1000;
    else {
      if (remaining <= 0) setRemaining(duration);
      endAtRef.current =
        Date.now() + (remaining > 0 ? remaining : duration) * 1000;
    }
    setRunning(true);
  }

  function pause() {
    if (mode !== "stopwatch")
      setRemaining(
        Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)),
      );
    else setElapsed(Math.max(0, (Date.now() - startedAtRef.current) / 1000));
    setRunning(false);
  }

  function reset() {
    setRunning(false);
    setElapsed(0);
    setRemaining(duration);
  }
  function changeDuration(minutes: number, seconds: number) {
    const next = Math.max(1, Math.min(86_400, minutes * 60 + seconds));
    setDuration(next);
    setRemaining(next);
    setRunning(false);
  }
  function addRecord(recordMode: TimerMode, seconds: number) {
    const current = readHistory();
    writeHistory([
      {
        id: crypto.randomUUID(),
        mode: recordMode,
        seconds: Math.round(seconds),
        completedAt: Date.now(),
      },
      ...current,
    ]);
  }

  const displaySeconds = mode === "stopwatch" ? elapsed : remaining;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>
            {pick("倒计时、番茄钟与秒表", "Countdown, Pomodoro, and stopwatch")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(["countdown", "pomodoro", "stopwatch"] as TimerMode[]).map(
              (item) => (
                <Button
                  key={item}
                  variant={mode === item ? "default" : "outline"}
                  onClick={() => selectMode(item)}
                >
                  {
                    {
                      countdown: pick("倒计时", "Countdown"),
                      pomodoro: pick("番茄钟", "Pomodoro"),
                      stopwatch: pick("秒表", "Stopwatch"),
                    }[item]
                  }
                </Button>
              ),
            )}
          </div>
          {mode !== "stopwatch" && !running ? (
            <div className="grid max-w-sm grid-cols-2 gap-3">
              <label className="grid gap-2 text-sm">
                <span>{pick("分钟", "Minutes")}</span>
                <Input
                  type="number"
                  min="0"
                  max="1440"
                  value={Math.floor(duration / 60)}
                  onChange={(event) =>
                    changeDuration(Number(event.target.value), duration % 60)
                  }
                />
              </label>
              <label className="grid gap-2 text-sm">
                <span>{pick("秒", "Seconds")}</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={duration % 60}
                  onChange={(event) =>
                    changeDuration(
                      Math.floor(duration / 60),
                      Number(event.target.value),
                    )
                  }
                />
              </label>
            </div>
          ) : null}
          <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[.04] px-5 py-12 text-center">
            <p className="font-mono text-6xl font-semibold tracking-[-.06em] text-cyan-200 sm:text-8xl">
              {formatDuration(displaySeconds)}
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              {running
                ? pick("计时中", "Running")
                : displaySeconds > 0
                  ? pick("已暂停", "Paused")
                  : pick("准备开始", "Ready")}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {running ? (
              <Button onClick={pause}>
                <Pause />
                {pick("暂停", "Pause")}
              </Button>
            ) : (
              <Button onClick={start}>
                <Play />
                {displaySeconds > 0 && (elapsed > 0 || remaining < duration)
                  ? pick("继续", "Resume")
                  : pick("开始", "Start")}
              </Button>
            )}
            <Button variant="outline" onClick={reset}>
              <RotateCcw />
              {pick("重置", "Reset")}
            </Button>
            {mode === "stopwatch" && !running && elapsed >= 1 ? (
              <Button
                variant="outline"
                onClick={() => addRecord("stopwatch", elapsed)}
              >
                <Save />
                {pick("保存记录", "Save session")}
              </Button>
            ) : null}
          </div>
          <p className="text-center text-xs text-zinc-500">
            {pick(
              "关闭页面会停止当前计时；已完成记录只保存在当前浏览器。",
              "Closing the page stops the active timer; saved history stays only in this browser.",
            )}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>
            {pick("本地完成记录", "Local completion history")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {history.length ? (
            <>
              <div className="space-y-2">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {
                          {
                            countdown: pick("倒计时", "Countdown"),
                            pomodoro: pick("番茄钟", "Pomodoro"),
                            stopwatch: pick("秒表", "Stopwatch"),
                          }[item.mode]
                        }
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {formatDuration(item.seconds)} ·{" "}
                        {new Intl.DateTimeFormat(localeForLanguage(language), {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(item.completedAt)}
                      </p>
                    </div>
                    <History className="size-4 text-zinc-600" />
                  </div>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => writeHistory([])}
              >
                <Trash2 />
                {pick("清除记录", "Clear history")}
              </Button>
            </>
          ) : (
            <div className="py-12 text-center">
              <Timer className="mx-auto size-7 text-zinc-700" />
              <p className="mt-3 text-sm text-zinc-500">
                {pick(
                  "完成计时后会显示在这里。",
                  "Completed sessions will appear here.",
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
function playFinishedTone(context: AudioContext | null) {
  if (!context) return;
  void context.resume().then(() => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  });
}
