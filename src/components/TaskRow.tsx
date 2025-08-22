import { useState } from "react";
import type { Task } from "../types";
import { EditIcon, TrashIcon } from "lucide-react";

type TaskRowProps = {
	task: Task;
	categories: string[];
	projects: string[];
	dotFor: (name?: string) => string;
	badgeFor: (name?: string) => string;
	onUpdate: (id: string, fields: Partial<Task>) => void;
	onDelete: (id: string) => void;
};

export default function TaskRow({ task, categories, projects, dotFor, badgeFor, onUpdate, onDelete }: TaskRowProps) {
	const [editing, setEditing] = useState<boolean>(false);
	const [title, setTitle] = useState<string>(task.title);
	const [cat, setCat] = useState<string>(task.category);
	const [proj, setProj] = useState<string>(task.project);

	const save = () => {
		onUpdate(task.id, { title: title.trim() || task.title, category: cat, project: proj });
		setEditing(false);
	};

	return (
		<li className="py-3">
			<div className="flex items-start gap-3">
				<label className="flex items-center">
					<input
						type="checkbox"
						className="mt-1 h-4 w-4 accent-neutral-900"
						checked={task.done}
						onChange={e => onUpdate(task.id, { done: e.currentTarget.checked })}
						title="Mark task as completed"
					/>
					<span className="sr-only">Mark task as completed</span>
				</label>

				<div className="flex-1">
					{!editing ? (
						<>
							<div className={`text-sm ${task.done ? "line-through text-neutral-400" : "text-neutral-900 dark:text-neutral-100"}`}>{task.title}</div>
							<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-neutral-600 dark:text-neutral-300">
								<span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${badgeFor(task.category)}`}>
									<span className={`h-1.5 w-1.5 rounded-full ${dotFor(task.category)}`}></span>
									{task.category}
								</span>
								<span className="opacity-70">•</span>
								<span className={`inline-flex items-center gap-2 rounded-full px-2 py-0.5 ${badgeFor(task.project)}`}>
									<span className={`h-1.5 w-1.5 rounded-full ${dotFor(task.project)}`}></span>
									{task.project}
								</span>
								<span className="opacity-70">•</span>
								<span>{new Date(task.createdAt).toLocaleDateString()}</span>
							</div>
						</>
					) : (
						<div className="flex flex-col md:flex-row gap-2">
							<input
								className="flex-1 rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:bg-neutral-800 dark:border-neutral-700"
								value={title}
								onChange={e => setTitle(e.target.value)}
								placeholder="Edit task title"
								title="Task Title"
							/>
							<select
								className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:bg-neutral-800 dark:border-neutral-700"
								value={cat}
								onChange={e => setCat(e.target.value)}
								title="Select Category"
								aria-label="Select Category">
								{[...new Set([task.category, ...categories])].map(c => (
									<option key={c}>{c}</option>
								))}
							</select>
							<select
								className="rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm dark:bg-neutral-800 dark:border-neutral-700"
								value={proj}
								onChange={e => setProj(e.target.value)}
								title="Select Project"
								aria-label="Select Project">
								{[...new Set([task.project, ...projects])].map(p => (
									<option key={p}>{p}</option>
								))}
							</select>
							<div className="flex gap-2">
								<button type="button" onClick={save} className="rounded-2xl bg-neutral-900 text-white px-3 py-2 text-sm hover:opacity-90 dark:bg-white dark:text-neutral-900">
									Save
								</button>
								<button
									type="button"
									onClick={() => setEditing(false)}
									className="rounded-2xl bg-neutral-200 text-neutral-900 px-3 py-2 text-sm hover:bg-neutral-300 dark:bg-neutral-700 dark:text-neutral-100 dark:hover:bg-neutral-600">
									Cancel
								</button>
							</div>
						</div>
					)}
				</div>

				<div className="flex items-center gap-2">
					{!editing && (
						<button
							type="button"
							title="Edit"
							onClick={() => setEditing(true)}
							className="rounded-xl border border-neutral-200 bg-white p-2 hover:bg-neutral-100 dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700">
							<EditIcon />
						</button>
					)}
					<button
						type="button"
						title="Delete"
						onClick={() => onDelete(task.id)}
						className="rounded-xl border border-neutral-200 bg-white p-2 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700 dark:bg-neutral-800 dark:border-neutral-700 dark:hover:bg-neutral-700">
						<TrashIcon />
					</button>
				</div>
			</div>
		</li>
	);
}
