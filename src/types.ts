export type Phase = "focus" | "break";

export type Settings = {
    presetName: string;
    focusMin: number;
    breakMin: number;
    autoStartNext: boolean;
};

export type CustomPreset = {
    name: string;
    focusMin: number;
    breakMin: number;
};

export type Task = {
    id: string;
    title: string;
    category: string;
    project: string;
    done: boolean;
    createdAt: number; // epoch ms
};

export type DaySession = {
    ts: number; // epoch ms
    minutes: number;
    preset: string;
};

export type HistoryDay = {
    count: number;
    minutes: number;
    sessions: DaySession[];
};

export type HistoryMap = Record<string, HistoryDay>; // YYYY-MM-DD -> data