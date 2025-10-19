// React + Headless UI super admin panel for folder management
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Dialog, Transition } from "@headlessui/react";

async function api(path, init) {
    // Browser already authenticated via Basic Auth, credentials are automatically sent
    const res = await fetch(path, {
        ...init,
        credentials: 'include', // Include cookies and auth headers
    });

    if (!res.ok) {
        if (res.status === 401) {
            throw new Error("Authentication failed. Please refresh the page and login again.");
        }
        if (res.status === 403) {
            throw new Error("Access denied. Super admin credentials required.");
        }
        const text = await res.text();
        throw new Error(text || res.statusText);
    }
    return res.json();
}

function useFolders() {
    const [folders, setFolders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function refresh() {
        setLoading(true);
        setError("");
        try {
            const data = await fetch("/api/folders").then((r) => r.json());
            setFolders(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        refresh();
    }, []);

    return { folders, loading, error, refresh };
}

function useSketches() {
    const [sketches, setSketches] = useState([]);
    const [loading, setLoading] = useState(true);

    async function load() {
        setLoading(true);
        try {
            const data = await fetch("/api/sketches").then((r) => r.json());
            setSketches(data);
        } catch (e) {
            console.error("Failed to load sketches:", e);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, []);

    return { sketches, loading };
}

function AddFolderDialog({ open, onClose, onAdded }) {
    const [form, setForm] = useState({ id: "", name: "", isDefault: false });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    async function submit(e) {
        e?.preventDefault();
        setSaving(true);
        setErr("");
        try {
            const created = await api("/api/folders", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            onAdded(created);
            onClose();
            setForm({ id: "", name: "", isDefault: false });
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
                    <Dialog.Panel className="w-full max-w-md rounded bg-white p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-semibold">Add Folder</Dialog.Title>
                        <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
                            <label className="text-sm">
                                Folder ID (e.g., "week1", "week2")
                                <input
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.id}
                                    onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
                                    placeholder="week1"
                                    required
                                    pattern="[a-z0-9_-]+"
                                    title="Only lowercase letters, numbers, underscores, and hyphens"
                                />
                            </label>
                            <label className="text-sm">
                                Folder Name (e.g., "Week 1")
                                <input
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    placeholder="Week 1"
                                    required
                                />
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.isDefault}
                                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                                />
                                Set as default folder
                            </label>

                            {err && <div className="text-sm text-red-600">{err}</div>}

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={saving}
                                >
                                    {saving ? "Adding…" : "Add"}
                                </button>
                            </div>
                        </form>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </Transition>
    );
}

function EditFolderDialog({ open, onClose, folder, onSaved }) {
    const [form, setForm] = useState(() => folder || { id: "", name: "", isDefault: false });
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState("");

    useEffect(() => {
        if (folder) {
            setForm(folder);
        }
    }, [folder]);

    async function submit(e) {
        e?.preventDefault();
        setSaving(true);
        setErr("");
        try {
            await api(`/api/folders/${encodeURIComponent(folder.id)}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: form.name, isDefault: form.isDefault }),
            });
            onSaved();
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
                    <Dialog.Panel className="w-full max-w-md rounded bg-white p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-semibold">Edit Folder</Dialog.Title>
                        <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
                            <div className="text-sm">
                                <div className="font-medium text-gray-500">Folder ID (cannot be changed)</div>
                                <div className="mt-1 rounded bg-gray-100 px-2 py-1">{form.id}</div>
                            </div>
                            <label className="text-sm">
                                Folder Name
                                <input
                                    className="mt-1 w-full rounded border px-2 py-1"
                                    value={form.name}
                                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                    required
                                />
                            </label>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={form.isDefault}
                                    onChange={(e) => setForm((f) => ({ ...f, isDefault: e.target.checked }))}
                                />
                                Set as default folder
                            </label>

                            {err && <div className="text-sm text-red-600">{err}</div>}

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose}>
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
                                    disabled={saving}
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

function ConfirmDialog({ open, onClose, title, description, confirmText = "Confirm", onConfirm, variant = "danger" }) {
    return (
        <Transition show={open}>
            <Dialog onClose={onClose} className="relative z-50">
                <div className="fixed inset-0 bg-black/30" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel className="w-full max-w-md rounded bg-white p-6 shadow-xl">
                        <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                        {description && <Dialog.Description className="mt-2 text-sm text-gray-600 whitespace-pre-line">{description}</Dialog.Description>}
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="rounded px-3 py-2 text-sm hover:bg-gray-100" onClick={onClose}>
                                Cancel
                            </button>
                            <button
                                className={`rounded px-3 py-2 text-sm text-white ${
                                    variant === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                                }`}
                                onClick={onConfirm}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </Dialog.Panel>
                </div>
            </Dialog>
        </Transition>
    );
}

function SuperAdminApp() {
    const { folders, loading, error, refresh } = useFolders();
    const { sketches } = useSketches();
    const [addOpen, setAddOpen] = useState(false);
    const [toDelete, setToDelete] = useState(null);
    const [toEdit, setToEdit] = useState(null);

    async function handleDelete(folderId) {
        try {
            await api(`/api/folders/${encodeURIComponent(folderId)}`, { method: "DELETE" });
            await refresh();
            setToDelete(null);
        } catch (e) {
            alert("Failed to delete folder: " + e.message);
        }
    }

    function getSketchCount(folderId) {
        return sketches.filter((s) => s.week === folderId).length;
    }

    function getDeleteWarning(folder) {
        const count = getSketchCount(folder.id);
        if (count === 0) return null;
        return `This folder contains ${count} sketch${count > 1 ? "es" : ""}.\nDeleting it will require reassigning these sketches to another folder.`;
    }

    return (
        <div className="mx-auto max-w-6xl p-6">
            <div className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                <strong>Note:</strong> When prompted for credentials, use your super admin username and password from the .env file.
            </div>
            <header className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Super Admin: Manage Folders</h1>
                    <p className="text-sm text-gray-600">Total folders: {folders.length}</p>
                </div>
                <div className="flex gap-2">
                    <button className="rounded bg-gray-100 px-3 py-2 text-sm hover:bg-gray-200" onClick={refresh}>
                        Refresh
                    </button>
                    <button className="rounded bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700" onClick={() => setAddOpen(true)}>
                        Add Folder
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
                                <th className="px-4 py-2 font-medium">Folder ID</th>
                                <th className="px-4 py-2 font-medium">Name</th>
                                <th className="px-4 py-2 font-medium">Default</th>
                                <th className="px-4 py-2 font-medium">Sketches</th>
                                <th className="px-4 py-2 font-medium">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {folders.map((f) => (
                                <tr key={f.id} className="border-t">
                                    <td className="px-4 py-2 font-mono text-xs">{f.id}</td>
                                    <td className="px-4 py-2">{f.name}</td>
                                    <td className="px-4 py-2">
                                        {f.isDefault && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700">Default</span>}
                                    </td>
                                    <td className="px-4 py-2">{getSketchCount(f.id)}</td>
                                    <td className="px-4 py-2 flex gap-2">
                                        <button className="rounded bg-gray-700 px-3 py-1 text-xs text-white hover:bg-gray-800" onClick={() => setToEdit(f)}>
                                            Edit
                                        </button>
                                        <button className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700" onClick={() => setToDelete(f)}>
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <AddFolderDialog open={addOpen} onClose={() => setAddOpen(false)} onAdded={() => refresh()} />
            <EditFolderDialog open={!!toEdit} onClose={() => setToEdit(null)} folder={toEdit} onSaved={() => refresh()} />
            <ConfirmDialog
                open={!!toDelete}
                onClose={() => setToDelete(null)}
                title="Delete folder?"
                description={toDelete ? `Folder: ${toDelete.name} (${toDelete.id})\n\n${getDeleteWarning(toDelete) || "This folder is empty and can be safely deleted."}` : ""}
                confirmText="Delete"
                onConfirm={() => handleDelete(toDelete.id)}
                variant="danger"
            />
        </div>
    );
}

export default function bootstrap() {
    const el = document.getElementById("root");
    if (!el) return;
    createRoot(el).render(<SuperAdminApp />);
}
