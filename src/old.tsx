import React, { useEffect, useMemo, useRef, useState, type JSX } from "react";
import TaskRow from "./components/TaskRow";
import type { CustomPreset, HistoryDay, HistoryMap, Phase, Settings, Task } from "./types";
import { FilterIcon, MoonIcon, PauseIcon, PlayIcon, PlusIcon, RotateCcwIcon, SkipBackIcon, SunIcon } from "lucide-react";

/**
 * Hybrid Pomodoro + Todo (TypeScript + Tailwind)
 * Features:
 * - Presets: Deep Work (90/15), Flow (50/10), and Custom
 * - Dark mode with localStorage persistence
 * - Todo list with Categories & Projects (CRUD + filters + search)
 * - Session History (per-day counts & minutes, plus today's timeline)
 * - Minimal sound alert at phase switch (Web Audio API)
 *
 * Drop this component into a React + Tailwind project. File can be named `HybridPomodoroApp.tsx`.
 */

// =========================
// Helpers
// =========================

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
const secondsToClock = (s: number) => `${pad(Math.floor(s / 60))}:${pad(Math.floor(s % 60))}`;
const todayKey = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

const hashToIndex = (str: string, modulo: number) => {
	let h = 0 >>> 0;
	for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
	return h % modulo;
};

const PALETTES = [
	{ badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300", dot: "bg-blue-500" },
	{ badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", dot: "bg-emerald-500" },
	{ badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300", dot: "bg-amber-500" },
	{ badge: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300", dot: "bg-fuchsia-500" },
	{ badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300", dot: "bg-rose-500" },
	{ badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300", dot: "bg-cyan-500" },
	{ badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300", dot: "bg-indigo-500" },
	{ badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300", dot: "bg-teal-500" }
] as const;

const badgeFor = (name?: string) => PALETTES[hashToIndex(name || "General", PALETTES.length)].badge;
const dotFor = (name?: string) => PALETTES[hashToIndex(name || "General", PALETTES.length)].dot;

// =========================
// Local Storage
// =========================

function loadLS<T>(key: string, fallback: T): T {
	try {
		const v = localStorage.getItem(key);
		return v ? (JSON.parse(v) as T) : fallback;
	} catch {
		return fallback;
	}
}
function saveLS<T>(key: string, value: T) {
	localStorage.setItem(key, JSON.stringify(value));
}

// =========================
// Main Component
// =========================

const DEFAULT_CATEGORIES = ["General", "Feature", "Bugfix", "Review"] as const;
const DEFAULT_PROJECTS = ["General", "MindMesh", "Client A"] as const;

export default function HybridPomodoroApp(): JSX.Element {
	// Theme
	const [dark, setDark] = useState<boolean>(() => loadLS<boolean>("pomodoro_theme_v1", false));
	useEffect(() => saveLS("pomodoro_theme_v1", dark), [dark]);

	// Presets
	const defaultSettings = useMemo<Settings>(
		() =>
			loadLS<Settings>("pomodoro_settings_v3", {
				presetName: "Deep Work (90/15)",
				focusMin: 90,
				breakMin: 15,
				autoStartNext: true
			}),
		[]
	);

	const [settings, setSettings] = useState<Settings>(defaultSettings);
	const [customPreset, setCustomPreset] = useState<CustomPreset>({ name: "Custom", focusMin: 60, breakMin: 10 });
	const [activeTab, setActiveTab] = useState<"timer" | "tasks" | "history" | "settings">("timer");

	// Timer state
	const [isRunning, setIsRunning] = useState<boolean>(false);
	const [phase, setPhase] = useState<Phase>("focus");
	const [remaining, setRemaining] = useState<number>(settings.focusMin * 60);
	const [completedSessions, setCompletedSessions] = useState<number>(0);

	const intervalRef = useRef<number | null>(null);
	const lastTickRef = useRef<number | null>(null);

	// Todo state
	const [categories, setCategories] = useState<string[]>(() => loadLS<string[]>("pomodoro_categories_v3", [...DEFAULT_CATEGORIES] as unknown as string[]));
	const [projects, setProjects] = useState<string[]>(() => loadLS<string[]>("pomodoro_projects_v1", [...DEFAULT_PROJECTS] as unknown as string[]));
	const [tasks, setTasks] = useState<Task[]>(() => loadLS<Task[]>("pomodoro_tasks_v3", []));
	const [filterCat, setFilterCat] = useState<string>("All");
	const [filterProject, setFilterProject] = useState<string>("All");
	const [search, setSearch] = useState<string>("");

	// History
	const [history, setHistory] = useState<HistoryMap>(() => loadLS<HistoryMap>("pomodoro_history_v2", {}));

	// Persist
	useEffect(() => saveLS("pomodoro_settings_v3", settings), [settings]);
	useEffect(() => saveLS("pomodoro_tasks_v3", tasks), [tasks]);
	useEffect(() => saveLS("pomodoro_categories_v3", categories), [categories]);
	useEffect(() => saveLS("pomodoro_projects_v1", projects), [projects]);
	useEffect(() => saveLS("pomodoro_history_v2", history), [history]);

	// Update remaining when settings/phase changes if not running
	useEffect(() => {
		if (!isRunning) setRemaining((phase === "focus" ? settings.focusMin : settings.breakMin) * 60);
	}, [settings.focusMin, settings.breakMin, phase, isRunning]);

	// Timer engine
	useEffect(() => {
		if (!isRunning) return;

		const tick = () => {
			const now = performance.now();
			if (lastTickRef.current == null) lastTickRef.current = now;
			const dt = Math.max(0, Math.round((now - lastTickRef.current) / 1000));
			lastTickRef.current = now;
			setRemaining(prev => Math.max(0, prev - dt));
		};

		const id = window.setInterval(tick, 500);
		intervalRef.current = id as unknown as number;
		return () => {
			if (intervalRef.current) window.clearInterval(intervalRef.current);
			intervalRef.current = null;
			lastTickRef.current = null;
		};
	}, [isRunning]);

	// Phase switcher & History logging
	useEffect(() => {
		if (remaining > 0) return;

		// Beep
		try {
			// @ts-expect-error webkitAudioContext for Safari
			const AC: typeof AudioContext = window.AudioContext || window.webkitAudioContext;
			const ctx = new AC();
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.type = "sine";
			o.frequency.value = phase === "focus" ? 660 : 440;
			o.connect(g);
			g.connect(ctx.destination);
			g.gain.setValueAtTime(0.0001, ctx.currentTime);
			g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
			g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
			o.start();
			o.stop(ctx.currentTime + 0.45);
		} catch {
			// Intentionally ignore beep errors (e.g., unsupported browser)
		}

		if (phase === "focus") {
			// log completed focus to history
			const key = todayKey();
			const minutes = settings.focusMin;
			setHistory(h => {
				const day: HistoryDay = h[key] || { count: 0, minutes: 0, sessions: [] };
				return {
					...h,
					[key]: {
						count: day.count + 1,
						minutes: day.minutes + minutes,
						sessions: [...day.sessions, { ts: Date.now(), minutes, preset: settings.presetName }]
					}
				};
			});

			setCompletedSessions(n => n + 1);
			setPhase("break");
			setRemaining(settings.breakMin * 60);
			setIsRunning(settings.autoStartNext);
		} else {
			setPhase("focus");
			setRemaining(settings.focusMin * 60);
			setIsRunning(settings.autoStartNext);
		}
	}, [remaining, phase, settings.autoStartNext, settings.breakMin, settings.focusMin, settings.presetName]);

	// ---------- Timer Actions ----------
	const start = () => setIsRunning(true);
	const pause = () => setIsRunning(false);
	const reset = () => {
		setIsRunning(false);
		setPhase("focus");
		setRemaining(settings.focusMin * 60);
		setCompletedSessions(0);
	};
	const skip = () => {
		setIsRunning(false);
		if (phase === "focus") {
			setPhase("break");
			setRemaining(settings.breakMin * 60);
		} else {
			setPhase("focus");
			setRemaining(settings.focusMin * 60);
		}
		setIsRunning(settings.autoStartNext);
	};
	const applyPreset = (name: string, focusMin: number, breakMin: number) => {
		setSettings(s => ({ ...s, presetName: name, focusMin, breakMin }));
		setPhase("focus");
		setIsRunning(false);
		setRemaining(focusMin * 60);
	};

	// ---------- Todo Actions ----------
	const addTask = (title: string, category?: string, project?: string) => {
		const trimmed = title.trim();
		if (!trimmed) return;
		const t: Task = {
			id: crypto.randomUUID(),
			title: trimmed,
			category: category || "General",
			project: project || "General",
			done: false,
			createdAt: Date.now()
		};
		setTasks(arr => [t, ...arr]);
	};
	const updateTask = (id: string, fields: Partial<Task>) => setTasks(arr => arr.map(t => (t.id === id ? { ...t, ...fields } : t)));
	const deleteTask = (id: string) => setTasks(arr => arr.filter(t => t.id !== id));

	const addCategory = (name: string) => {
		const n = name.trim();
		if (!n) return;
		setCategories(arr => (arr.includes(n) ? arr : [...arr, n]));
	};
	const addProject = (name: string) => {
		const n = name.trim();
		if (!n) return;
		setProjects(arr => (arr.includes(n) ? arr : [...arr, n]));
	};

	const filteredTasks = tasks.filter(t => {
		const okCat = filterCat === "All" || t.category === filterCat;
		const okProj = filterProject === "All" || t.project === filterProject;
		const okSearch = !search.trim() || t.title.toLowerCase().includes(search.toLowerCase());
		return okCat && okProj && okSearch;
	});

	const completedCount = tasks.filter(t => t.done).length;

	// History helpers
	const lastNDays = (n: number): Array<{ key: string; label: string; data: HistoryDay }> => {
		const arr: Array<{ key: string; label: string; data: HistoryDay }> = [];
		const d = new Date();
		for (let i = 0; i < n; i++) {
			const dt = new Date(d);
			dt.setDate(d.getDate() - i);
			const key = dt.toISOString().slice(0, 10);
			arr.push({ key, label: dt.toLocaleDateString(), data: history[key] || { count: 0, minutes: 0, sessions: [] } });
		}
		return arr.reverse();
	};

	return (
		<html lang="en">
			<head>
				<meta charSet="UTF-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<title>Document</title>
			</head>
			<body>
				<div className={dark ? "dark" : ""}>
					<div className="min-h-[100dvh] w-full bg-neutral-50 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
						{/* App shell */}
						<div className="mx-auto max-w-6xl p-4 sm:p-6">
							<header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<h1 className="flex items-center gap-1 text-2xl sm:text-3xl font-semibold tracking-tight">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										width="24"
										height="24"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
										strokeLinejoin="round"
										className="mt-1">
										<path d="M5 22h14" />
										<path d="M5 2h14" />
										<path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
										<path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
									</svg>
									FlowForge
								</h1>
								<div className="flex items-center gap-2 text-sm">
									<span className="rounded-full px-3 py-1 bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
										Preset: <strong className="ml-1">{settings.presetName}</strong>
									</span>
									<span className="hidden sm:inline-block rounded-full px-3 py-1 bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100">
										Focus {settings.focusMin}m • Break {settings.breakMin}m
									</span>
									<label className="ml-2 inline-flex items-center gap-2 select-none cursor-pointer">
										<input
											type="checkbox"
											className="h-4 w-4 accent-neutral-800"
											checked={settings.autoStartNext}
											onChange={e => setSettings(s => ({ ...s, autoStartNext: e.target.checked }))}
										/>
										<span className="text-sm">Auto-start</span>
									</label>
									<button
										type="button"
										onClick={() => setDark(v => !v)}
										className="ml-2 inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700">
										{dark ? <SunIcon /> : <MoonIcon />}
										{dark ? "Light" : "Dark"}
									</button>
								</div>
							</header>

							{/* Tabs */}
							<div className="mt-6 flex flex-wrap gap-2 text-sm">
								{(
									[
										{ id: "timer", label: "Timer" },
										{ id: "tasks", label: "Tasks" },
										{ id: "history", label: "History" },
										{ id: "settings", label: "Settings" }
									] as const
								).map(t => (
									<button
										key={t.id}
										className={`rounded-xl px-3 py-1.5 border ${
											activeTab === t.id
												? "bg-neutral-900 text-white border-neutral-900 dark:bg-white dark:text-neutral-900 dark:border-white"
												: "bg-white border-neutral-300 dark:bg-neutral-800 dark:border-neutral-700"
										}`}
										onClick={() => setActiveTab(t.id)}>
										{t.label}
									</button>
								))}
							</div>

							{activeTab === "timer" && (
								<section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
									{/* Timer Card */}
									<div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<div className="flex items-center justify-between">
											<div className="text-sm uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{phase === "focus" ? "Focus" : "Break"} session</div>
											<div className="text-sm text-neutral-500 dark:text-neutral-400">
												Completed today: <strong>{completedSessions}</strong>
											</div>
										</div>

										<div className="mt-6 flex flex-col items-center">
											<div className="text-[64px] sm:text-[80px] font-semibold tabular-nums leading-none">{secondsToClock(remaining)}</div>
											<div className="mt-4 flex items-center gap-2">
												{!isRunning ? (
													<button
														type="button"
														onClick={start}
														className="w-[100px] inline-flex items-center gap-2 rounded-2xl bg-neutral-900 text-white px-4 py-2 shadow hover:opacity-90 dark:bg-white dark:text-neutral-900 cursor-pointer">
														<PlayIcon width={20} height={20} /> Start
													</button>
												) : (
													<button
														type="button"
														onClick={pause}
														className="w-[100px] inline-flex items-center gap-2 rounded-2xl bg-neutral-900 text-white px-4 py-2 shadow hover:opacity-90 dark:bg-white dark:text-neutral-900 cursor-pointer">
														<PauseIcon /> Pause
													</button>
												)}
												<button
													type="button"
													onClick={reset}
													className="w-[100px] inline-flex items-center gap-2 rounded-2xl bg-neutral-200 text-neutral-900 px-4 py-2 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 cursor-pointer">
													<RotateCcwIcon /> Reset
												</button>
												<button
													type="button"
													onClick={skip}
													className="w-[100px] inline-flex items-center gap-2 rounded-2xl bg-neutral-200 text-neutral-900 px-4 py-2 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600 cursor-pointer">
													<SkipBackIcon /> Skip
												</button>
											</div>

											<div className="mt-6 grid grid-cols-2 gap-3 w-full sm:max-w-md">
												<button
													type="button"
													onClick={() => applyPreset("Deep Work (90/15)", 90, 15)}
													className={`cursor-pointer rounded-2xl border px-3 py-2 text-left ${
														settings.presetName === "Deep Work (90/15)"
															? "border-neutral-900 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 dark:border-white"
															: "border-neutral-300 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
													}`}>
													<div className="text-sm font-semibold">Deep Work</div>
													<div className="text-xs opacity-80">90 min focus • 15 min break</div>
												</button>
												<button
													type="button"
													onClick={() => applyPreset("Flow (50/10)", 50, 10)}
													className={`cursor-pointer rounded-2xl border px-3 py-2 text-left ${
														settings.presetName === "Flow (50/10)"
															? "border-neutral-900 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 dark:border-white"
															: "border-neutral-300 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
													}`}>
													<div className="text-sm font-semibold">Flow</div>
													<div className="text-xs opacity-80">50 min focus • 10 min break</div>
												</button>
											</div>
										</div>
									</div>

									{/* Summary */}
									<div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<h3 className="text-lg font-semibold">Session Summary</h3>
										<ul className="mt-3 space-y-2 text-sm text-neutral-700 dark:text-neutral-300">
											<li>
												Preset: <strong>{settings.presetName}</strong>
											</li>
											<li>Next switch: {phase === "focus" ? `${settings.breakMin}m break` : `${settings.focusMin}m focus`}</li>
											<li>
												Auto-start next: <strong>{settings.autoStartNext ? "On" : "Off"}</strong>
											</li>
											<li>
												Completed focus sessions this run: <strong>{completedSessions}</strong>
											</li>
										</ul>
										<div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-4 dark:border-neutral-600">
											<div className="text-sm font-medium mb-2">Pro tip</div>
											<p className="text-sm text-neutral-700 dark:text-neutral-300">
												Use <em>Deep Work</em> in the morning and switch to <em>Flow</em> in the afternoon. Toggle presets above without reconfiguring anything.
											</p>
										</div>
									</div>
								</section>
							)}

							{activeTab === "tasks" && (
								<section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
									{/* Add Task */}
									<div className="xl:col-span-1 rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<h3 className="text-lg font-semibold">Add Task</h3>
										<TaskForm categories={categories} projects={projects} onSubmit={addTask} />

										<div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
											<div>
												<h4 className="text-sm font-semibold mb-2">Categories</h4>
												<NameManager label="Add" items={categories} onAdd={addCategory} badge={badgeFor} dot={dotFor} placeholder="e.g. Research" />
											</div>
											<div>
												<h4 className="text-sm font-semibold mb-2">Projects</h4>
												<NameManager label="Add" items={projects} onAdd={addProject} badge={badgeFor} dot={dotFor} placeholder="e.g. MindMesh" />
											</div>
										</div>
									</div>

									{/* Task List */}
									<div className="xl:col-span-2 rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
											<h3 className="text-lg font-semibold">Tasks</h3>
											<div className="flex flex-wrap items-center gap-2">
												<div className="flex items-center gap-2 text-sm">
													<FilterIcon />
													<label htmlFor="filterCat" className="sr-only">
														Filter by Category
													</label>
													<select
														id="filterCat"
														className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 dark:bg-neutral-800 dark:border-neutral-700"
														value={filterCat}
														onChange={e => setFilterCat(e.target.value)}
														title="Filter by Category">
														<option>All</option>
														{categories.map(c => (
															<option key={c}>{c}</option>
														))}
													</select>
													<select
														className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 dark:bg-neutral-800 dark:border-neutral-700"
														value={filterProject}
														onChange={e => setFilterProject(e.target.value)}
														title="Filter by Project">
														<option>All</option>
														{projects.map(p => (
															<option key={p}>{p}</option>
														))}
													</select>
												</div>
												<input
													placeholder="Search tasks…"
													className="rounded-xl border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:bg-neutral-800 dark:border-neutral-700"
													value={search}
													onChange={e => setSearch(e.target.value)}
												/>
											</div>
										</div>

										<div className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">
											Total: {tasks.length} • Completed: {completedCount}
										</div>

										<ul className="mt-4 divide-y divide-neutral-200 dark:divide-neutral-700">
											{filteredTasks.length === 0 && <li className="py-8 text-center text-neutral-500 dark:text-neutral-400">No tasks found.</li>}
											{filteredTasks.map(t => (
												<TaskRow key={t.id} task={t} categories={categories} projects={projects} dotFor={dotFor} badgeFor={badgeFor} onUpdate={updateTask} onDelete={deleteTask} />
											))}
										</ul>
									</div>
								</section>
							)}

							{activeTab === "history" && (
								<section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
									<div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<h3 className="text-lg font-semibold">Past 14 Days</h3>
										<ul className="mt-4 space-y-2 text-sm">
											{lastNDays(14).map(({ key, label, data }) => (
												<li key={key} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/40">
													<span className="text-neutral-700 dark:text-neutral-300">{label}</span>
													<span className="tabular-nums text-neutral-900 dark:text-neutral-100">
														{data.count} sessions • {data.minutes} min
													</span>
												</li>
											))}
										</ul>
									</div>

									<div className="rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<h3 className="text-lg font-semibold">Today</h3>
										{(() => {
											const d = history[todayKey()] || { sessions: [], minutes: 0, count: 0 };
											if (d.sessions.length === 0) return <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-300">No completed focus sessions yet.</p>;
											return (
												<>
													<div className="mt-2 text-sm text-neutral-600 dark:text-neutral-300">
														Total: {d.count} • {d.minutes} minutes
													</div>
													<ul className="mt-3 space-y-2 text-sm">
														{d.sessions
															.slice()
															.reverse()
															.map((s, i) => (
																<li
																	key={`${s.ts}-${i}`}
																	className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 dark:border-neutral-700 dark:bg-neutral-900/40 flex items-center justify-between">
																	<span>{new Date(s.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
																	<span className="tabular-nums">{s.minutes} min</span>
																	<span className="opacity-70">{s.preset}</span>
																</li>
															))}
													</ul>
												</>
											);
										})()}
									</div>
								</section>
							)}

							{activeTab === "settings" && (
								<section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
									<div className="lg:col-span-2 rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<h3 className="text-lg font-semibold">Presets</h3>
										<div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
											<button
												onClick={() => applyPreset("Deep Work (90/15)", 90, 15)}
												className={`rounded-2xl border px-4 py-3 text-left ${
													settings.presetName === "Deep Work (90/15)"
														? "border-neutral-900 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 dark:border-white"
														: "border-neutral-300 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
												}`}>
												<div className="font-semibold">Deep Work</div>
												<div className="text-xs opacity-80">90 min focus • 15 min break</div>
											</button>
											<button
												onClick={() => applyPreset("Flow (50/10)", 50, 10)}
												className={`rounded-2xl border px-4 py-3 text-left ${
													settings.presetName === "Flow (50/10)"
														? "border-neutral-900 bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 dark:border-white"
														: "border-neutral-300 bg-neutral-50 hover:bg-neutral-100 dark:border-neutral-700 dark:bg-neutral-800 dark:hover:bg-neutral-700"
												}`}>
												<div className="font-semibold">Flow</div>
												<div className="text-xs opacity-80">50 min focus • 10 min break</div>
											</button>
											<div className="rounded-2xl border border-neutral-300 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800">
												<div className="font-semibold">Custom</div>
												<div className="mt-3 grid grid-cols-2 gap-2 text-sm">
													<label className="flex flex-col">
														<span className="text-neutral-600 dark:text-neutral-300">Focus (min)</span>
														<input
															type="number"
															min={5}
															className="rounded-xl border border-neutral-300 bg-white px-2 py-1.5 dark:bg-neutral-800 dark:border-neutral-700"
															value={customPreset.focusMin}
															onChange={e => setCustomPreset(p => ({ ...p, focusMin: Number(e.target.value) }))}
														/>
													</label>
													<label className="flex flex-col">
														<span className="text-neutral-600 dark:text-neutral-300">Break (min)</span>
														<input
															type="number"
															min={1}
															className="rounded-xl border border-neutral-300 bg-white px-2 py-1.5 dark:bg-neutral-800 dark:border-neutral-700"
															value={customPreset.breakMin}
															onChange={e => setCustomPreset(p => ({ ...p, breakMin: Number(e.target.value) }))}
														/>
													</label>
												</div>
												<button
													onClick={() => applyPreset(customPreset.name || "Custom", Math.max(5, customPreset.focusMin), Math.max(1, customPreset.breakMin))}
													className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-neutral-900 text-white px-4 py-2 hover:opacity-90 dark:bg-white dark:text-neutral-900">
													Apply Custom
												</button>
											</div>
										</div>
									</div>

									<div className="lg:col-span-1 rounded-3xl bg-white p-6 shadow-sm border border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700">
										<h3 className="text-lg font-semibold">Behavior & Storage</h3>
										<label className="mt-3 flex items-center justify-between rounded-2xl border border-neutral-200 p-3 dark:border-neutral-700">
											<div>
												<div className="text-sm font-medium">Auto-start next session</div>
												<div className="text-xs text-neutral-600 dark:text-neutral-300">When a session ends, automatically begin the next phase.</div>
											</div>
											<input
												type="checkbox"
												className="h-5 w-5 accent-neutral-900"
												checked={settings.autoStartNext}
												onChange={e => setSettings(s => ({ ...s, autoStartNext: e.target.checked }))}
											/>
										</label>

										<button
											onClick={() => {
												if (!confirm("Reset all data? This will clear tasks, categories, projects, settings & history.")) return;
												localStorage.removeItem("pomodoro_tasks_v3");
												localStorage.removeItem("pomodoro_categories_v3");
												localStorage.removeItem("pomodoro_projects_v1");
												localStorage.removeItem("pomodoro_settings_v3");
												localStorage.removeItem("pomodoro_history_v2");
												setTasks([]);
												setCategories([...DEFAULT_CATEGORIES] as unknown as string[]);
												setProjects([...DEFAULT_PROJECTS] as unknown as string[]);
												setHistory({});
												setDark(false);
												applyPreset("Deep Work (90/15)", 90, 15);
											}}
											className="mt-4 w-full rounded-2xl border border-rose-300 bg-rose-50 px-4 py-2 text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-300 dark:hover:bg-rose-900/40">
											Reset All Data
										</button>
									</div>
								</section>
							)}

							<footer className="mt-10 pb-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
								Built for focus-friendly coding sessions — 90/15 mornings, 50/10 afternoons. Stay hydrated 💧
							</footer>
						</div>
					</div>
				</div>
			</body>
		</html>
	);
}

// =========================
// Small Components (TS)
// =========================

type TaskFormProps = {
	categories: string[];
	projects: string[];
	onSubmit: (title: string, category?: string, project?: string) => void;
};

function TaskForm({ categories, projects, onSubmit }: TaskFormProps): JSX.Element {
	const [title, setTitle] = useState<string>("");
	const [cat, setCat] = useState<string>(categories[0] || "General");
	const [proj, setProj] = useState<string>(projects[0] || "General");

	useEffect(() => {
		if (!categories.includes(cat)) setCat(categories[0] || "General");
	}, [categories, cat]);
	useEffect(() => {
		if (!projects.includes(proj)) setProj(projects[0] || "General");
	}, [projects, proj]);

	const submit: React.FormEventHandler<HTMLFormElement> = e => {
		e.preventDefault();
		onSubmit(title, cat, proj);
		setTitle("");
	};

	return (
		<form onSubmit={submit} className="mt-3 space-y-3">
			<div className="flex flex-col gap-2">
				<label className="text-sm text-neutral-700 dark:text-neutral-300">Title</label>
				<input
					className="rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:bg-neutral-800 dark:border-neutral-700"
					placeholder="Implement login flow…"
					value={title}
					onChange={e => setTitle(e.target.value)}
				/>
			</div>
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<div className="flex flex-col gap-2">
					<label className="text-sm text-neutral-700 dark:text-neutral-300">Category</label>
					<select
						className="rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:bg-neutral-800 dark:border-neutral-700"
						value={cat}
						onChange={e => setCat(e.target.value)}
						title="Select Category">
						{categories.map(c => (
							<option key={c}>{c}</option>
						))}
					</select>
				</div>
				<div className="flex flex-col gap-2">
					<label className="text-sm text-neutral-700 dark:text-neutral-300">Project</label>
					<select
						id="taskFormProject"
						title="Select Project"
						className="rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:bg-neutral-800 dark:border-neutral-700"
						value={proj}
						onChange={e => setProj(e.target.value)}>
						{projects.map(p => (
							<option key={p}>{p}</option>
						))}
					</select>
				</div>
			</div>
			<button type="submit" className="inline-flex items-center gap-2 rounded-2xl bg-neutral-900 text-white px-4 py-2 hover:opacity-90 dark:bg-white dark:text-neutral-900">
				<PlusIcon /> Add Task
			</button>
		</form>
	);
}

type NameManagerProps = {
	label: string;
	items: string[];
	onAdd: (name: string) => void;
	badge: (name?: string) => string;
	dot: (name?: string) => string;
	placeholder?: string;
};

function NameManager({ label, items, onAdd, badge, dot, placeholder }: NameManagerProps): JSX.Element {
	const [name, setName] = useState<string>("");
	return (
		<div className="space-y-3">
			<div className="flex gap-2">
				<input
					className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 dark:bg-neutral-800 dark:border-neutral-700"
					placeholder={placeholder}
					value={name}
					onChange={e => setName(e.target.value)}
				/>
				<button
					onClick={() => {
						onAdd(name);
						setName("");
					}}
					className="rounded-2xl bg-neutral-200 text-neutral-900 px-4 py-2 hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600">
					{label}
				</button>
			</div>
			<div className="flex flex-wrap gap-2">
				{items.map(c => (
					<span key={c} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs ${badge(c)}`}>
						<span className={`h-2 w-2 rounded-full ${dot(c)}`}></span>
						{c}
					</span>
				))}
			</div>
		</div>
	);
}
