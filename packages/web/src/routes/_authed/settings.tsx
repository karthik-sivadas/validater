import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import {
  createApiKeyFn,
  listApiKeysFn,
  revokeApiKeyFn,
} from "@/server/api-keys";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RiFileCopyLine, RiAddLine, RiDeleteBinLine } from "@remixicon/react";

export const Route = createFileRoute("/_authed/settings")({
  loader: () => listApiKeysFn(),
  component: SettingsPage,
});

interface ApiKeyItem {
  id: string;
  name: string;
  start: string | null;
  createdAt: string;
  expiresAt: string | null;
  lastRequest: string | null;
  enabled: boolean;
}

function SettingsPage() {
  const router = useRouter();
  const keys = Route.useLoaderData() as ApiKeyItem[];

  const [createOpen, setCreateOpen] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  async function handleCreate() {
    if (!keyName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      const result = await createApiKeyFn({ data: { name: keyName.trim() } });
      setNewKeyValue(result.key);
      setKeyName("");
      // Refresh the list
      router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create API key");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    setRevokingId(keyId);
    try {
      await revokeApiKeyFn({ data: { keyId } });
      router.invalidate();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke API key");
    } finally {
      setRevokingId(null);
    }
  }

  function handleCopy() {
    if (newKeyValue) {
      navigator.clipboard.writeText(newKeyValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  function handleCloseCreate() {
    setCreateOpen(false);
    setNewKeyValue(null);
    setKeyName("");
    setError(null);
    setCopied(false);
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return "--";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your account settings and API keys
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base font-semibold">API Keys</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Create API keys to access the Validater API programmatically
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <RiAddLine className="mr-1.5 h-4 w-4" />
              Create Key
            </Button>

            <DialogContent>
              {newKeyValue ? (
                <>
                  <DialogHeader>
                    <DialogTitle>API Key Created</DialogTitle>
                    <DialogDescription>
                      Copy this key now. It will only be shown once and cannot be
                      retrieved later.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded border border-border bg-muted px-3 py-2 text-xs font-mono break-all select-all">
                        {newKeyValue}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                      >
                        <RiFileCopyLine className="mr-1 h-3.5 w-3.5" />
                        {copied ? "Copied" : "Copy"}
                      </Button>
                    </div>
                    <p className="text-xs text-destructive font-medium">
                      This key will only be shown once. Copy it now.
                    </p>
                  </div>

                  <DialogFooter>
                    <Button onClick={handleCloseCreate}>Done</Button>
                  </DialogFooter>
                </>
              ) : (
                <>
                  <DialogHeader>
                    <DialogTitle>Create API Key</DialogTitle>
                    <DialogDescription>
                      Give your API key a name to help identify it later.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="key-name">Name</Label>
                      <Input
                        id="key-name"
                        placeholder="e.g. CI/CD Pipeline"
                        value={keyName}
                        onChange={(e) => setKeyName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleCreate();
                        }}
                      />
                    </div>
                    {error && (
                      <p className="text-xs text-destructive">{error}</p>
                    )}
                  </div>

                  <DialogFooter>
                    <DialogClose render={<Button variant="outline" />}>
                      Cancel
                    </DialogClose>
                    <Button
                      onClick={handleCreate}
                      disabled={isCreating || !keyName.trim()}
                    >
                      {isCreating ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </>
              )}
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {keys.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No API keys yet. Create one to get started.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((key) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.name}</TableCell>
                    <TableCell>
                      <code className="text-xs text-muted-foreground">
                        {key.start ? `${key.start}...` : "***"}
                      </code>
                    </TableCell>
                    <TableCell>{formatDate(key.createdAt)}</TableCell>
                    <TableCell>{formatDate(key.lastRequest)}</TableCell>
                    <TableCell>
                      <Badge variant={key.enabled ? "default" : "destructive"}>
                        {key.enabled ? "Active" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRevoke(key.id)}
                        disabled={revokingId === key.id}
                        className="text-destructive hover:text-destructive"
                      >
                        <RiDeleteBinLine className="mr-1 h-3.5 w-3.5" />
                        {revokingId === key.id ? "Revoking..." : "Revoke"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
