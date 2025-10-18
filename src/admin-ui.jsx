// React + Headless UI admin panel (local packages)
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, Transition } from "@headlessui/react";

async function api(path, init) {
    const res = await fetch(path, init);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
}

function useSketches() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    async function refresh() {
        setLoading(true);
        setError("");
        try {
            const data = await api("/api/sketches");
            setItems(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        refresh();
    }, []);
    return { items, loading, error, refresh, setItems };
}
async function updateSketch(slug, payload) {
    const res = await fetch(`/api/sketches/${encodeURIComponent(slug)}` ,{
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
}

function EditSketchDialog({ open, onClose, sketch, onSaved }) {
    const [form, setForm] = useState(
        () => sketch || { author: "", title: "", description: "", url: "", width: 600, height: 600 }
    );
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const urlWarning =
        form.url && !/(p5js|openprocessing)/i.test(form.url)
            ? "The URL doesn't look like a p5.js or OpenProcessing link. Please double-check."
            : "";

    // keep form in sync when sketch changes
    useEffect(() => {
        setForm(sketch || { author: "", title: "", description: "", url: "", width: 600, height: 600 });
    }, [sketch]);

    async function submit(e) {
        e?.preventDefault();
        setSaving(true);
        setErr("");
        try {
            const payload = { ...form, width: Number(form.width), height: Number(form.height) };
            const saved = await updateSketch(sketch.slug, payload);
            onSaved(saved);
            onClose();
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <Transition show={open}>
            <Dialog onClose={onClose} className="relative z-50">
                <div className="fixed inset-0 bg-black/30" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-xl rounded bg-white p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-semibold">Edit Sketch</Dialog.Title>
                        <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={submit}>
                            <label className="col-span-1 text-sm">
                                Author
                                <input
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.author}
                                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="col-span-1 text-sm">
                                Title
                                <input
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="col-span-2 text-sm">
                                Description
                                <textarea
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    rows="3"
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                />
                            </label>
                            <label className="col-span-2 text-sm">
                                URL
                                <input
                                    type="url"
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.url}
                                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                                    required
                                />
                                {urlWarning && <div className="mt-1 text-xs text-amber-700">{urlWarning}</div>}
                            </label>
                            <label className="col-span-1 text-sm">
                                Width
                                <input
                                    type="number"
                                    min="1"
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.width}
                                    onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="col-span-1 text-sm">
                                Height
                                <input
                                    type="number"
                                    min="1"
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.height}
                                    onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
                                    required
                                />
                            </label>

                            {err && <div className="col-span-2 text-sm text-red-600">{err}</div>}

                            <div className="col-span-2 mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={saving || !!urlWarning}
                                >
                                    {saving ? "Saving…" : "Save"}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </Transition>
    );
}

function AddSketchDialog({ open, onClose, onAdded }) {
    const [form, setForm] = useState({ author: "", title: "", description: "", url: "", width: 600, height: 600 });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");
    const urlWarning =
        form.url && !/(p5js|openprocessing)/i.test(form.url)
            ? "The URL doesn't look like a p5.js or OpenProcessing link. Please double-check."
            : "";
    async function submit(e) {
        e?.preventDefault();
        setSaving(true);
        setErr("");
        try {
            const payload = { ...form, width: Number(form.width), height: Number(form.height) };
            const created = await api("/api/sketches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            onAdded(created);
            onClose();
            setForm({ author: "", title: "", description: "", url: "", width: 600, height: 600 });
        } catch (e) {
            setErr(e.message);
        } finally {
            setSaving(false);
        }
    }
    return (
        <Transition show={open}>
            <Dialog onClose={onClose} className="relative z-50">
                <div className="fixed inset-0" aria-hidden="true" />
                <div className="fixed inset-0 bg-black/30" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-xl rounded bg-white p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-semibold">Add Sketch</Dialog.Title>
                        <form className="mt-4 grid grid-cols-2 gap-3" onSubmit={submit}>
                            <label className="col-span-1 text-sm">
                                Author
                                <input
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.author}
                                    onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="col-span-1 text-sm">
                                Title
                                <input
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.title}
                                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="col-span-2 text-sm">
                                Description
                                <textarea
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    rows="3"
                                    value={form.description}
                                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                />
                            </label>
                            <label className="col-span-2 text-sm">
                                URL
                                <input
                                    type="url"
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.url}
                                    onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                                    required
                                />
                                {urlWarning && <div className="mt-1 text-xs text-amber-700">{urlWarning}</div>}
                            </label>
                            <label className="col-span-1 text-sm">
                                Width
                                <input
                                    type="number"
                                    min="1"
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.width}
                                    onChange={(e) => setForm((f) => ({ ...f, width: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="col-span-1 text-sm">
                                Height
                                <input
                                    type="number"
                                    min="1"
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.height}
                                    onChange={(e) => setForm((f) => ({ ...f, height: e.target.value }))}
                                    required
                                />
                            </label>

                            {err && <div className="col-span-2 text-sm text-red-600">{err}</div>}

                            <div className="col-span-2 mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={saving || !!urlWarning}
                                >
                                    {saving ? "Saving…" : "Add"}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </Transition>
    );
}

function ConfirmDialog({ open, onClose, title, description, confirmText = "Confirm", onConfirm }) {
    return (
        <Transition show={open}>
            <Dialog onClose={onClose} className="relative z-50">
                <div className="fixed inset-0 bg-black/30" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-md rounded bg-white p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                        {description && <Dialog.Description className="mt-1 text-sm text-gray-600">{description}</Dialog.Description>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="rounded px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose}>
                                Cancel
                            </button>
                            <button className="rounded bg-red-600 px-3 py-2 text-sm text-white hover:bg-red-700" onClick={onConfirm}>
                                {confirmText}
                            </button>
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </Transition>
    );
}

function AdminApp() {
    const { items, loading, error, refresh } = useSketches();
    const [addOpen, setAddOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const [toEdit, setToEdit] = useState(null);
    const total = items.length;

    async function handleDelete(slug) {
        await api(`/api/sketches/${encodeURIComponent(slug)}`, { method: "DELETE" });
        await refresh();
        setToDelete(null);
    }

    return (
        <div className="mx-auto max-w-6xl p-6">
            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Admin: Sketches</h1>
                    <p className="text-sm text-gray-600">Total: {total}</p>
                </div>
                <div className="flex gap-2">
                    <button className="rounded bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200" onClick={refresh}>
                        Refresh
                    </button>
                    <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" onClick={() => setAddOpen(true)}>
                        Add Sketch
                    </button>
                </div>
            </header>

            {loading && <div className="rounded border border-gray-200 bg-white p-4">Loading…</div>}
            {error && <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

            {!loading && !error && (
                <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-700">
                            <tr>
                                <th className="px-4 py-2 font-medium">Title</th>
                                <th className="px-4 py-2 font-medium">Author</th>
                                <th className="px-4 py-2 font-medium">URL</th>
                                <th className="px-4 py-2 font-medium">Size</th>
                                <th className="px-4 py-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((s) => (
                                <tr key={s.slug} className="border-t">
                                    <td className="px-4 py-2">{s.title}</td>
                                    <td className="px-4 py-2">{s.author}</td>
                                    <td className="px-4 py-2">
                                        <a className="text-blue-600 hover:underline" href={s.url} target="_blank" rel="noreferrer">
                                            link
                                        </a>
                                    </td>
                                    <td className="px-4 py-2">{s.width}×{s.height}</td>
                                    <td className="px-4 py-2 flex gap-2">
                                        <button className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-800" onClick={() => setToEdit(s)}>
                                            Edit
                                        </button>
                                        <button className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700" onClick={() => setToDelete(s)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AddSketchDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => refresh()} />
            <EditSketchDialog open={!!toEdit} onClose={() => setToEdit(null)} sketch={toEdit} onSaved={() => refresh()} />
            <ConfirmDialog
                open={!!toDelete}
                onClose={() => setToDelete(null)}
                title="Delete sketch?"
                description={toDelete ? `${toDelete.title} by ${toDelete.author}` : ""}
                confirmText="Delete"
                onConfirm={() => handleDelete(toDelete.slug)}
            />
        </div>
    );
}

export default function bootstrap() {
    const el = document.getElementById("root");
    if (!el) return;
    createRoot(el).render(<AdminApp />);
}
