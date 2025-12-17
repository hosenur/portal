import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import useLocalStorage from "@/hooks/use-local-storage";
import AppLayout from "@/layouts/app-layout";
import { PR_PREFIX_KEY } from "@/lib/constants";
import { toast } from "sonner";

export default function SettingsPage() {
  const [storedPrefix, setStoredPrefix] = useLocalStorage<string>(
    PR_PREFIX_KEY,
    "",
  );
  const [prefix, setPrefix] = useState("");

  // Sync local state with stored value
  useEffect(() => {
    setPrefix(storedPrefix);
  }, [storedPrefix]);

  const handleSave = () => {
    setStoredPrefix(prefix);
    toast.success("Settings saved!");
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-semibold mb-6">Settings</h1>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="pr-prefix">PR Branch Prefix</Label>
            <p className="text-sm text-muted-fg">
              This prefix will be added to branch names when creating pull
              requests. For example, if you set &quot;feature/&quot;, branches
              will be named like &quot;feature/my-branch&quot;.
            </p>
            <Input
              id="pr-prefix"
              type="text"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value)}
              placeholder="e.g., feature/, fix/, yourname/"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button onPress={handleSave}>Save Settings</Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
