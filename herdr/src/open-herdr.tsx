import {
  Action,
  ActionPanel,
  closeMainWindow,
  getPreferenceValues,
  Icon,
  Keyboard,
  List,
  openExtensionPreferences,
  showToast,
  Toast,
} from "@raycast/api";
import { useLocalStorage } from "@raycast/utils";
import { useMemo } from "react";
import { herdrArgs, openHerdr, remoteSessionName, resolveHerdrBinary, Target } from "./herdr";
import { parseSshConfig, SshHost } from "./ssh-config";

interface Preferences {
  herdrPath: string;
  configPath: string;
}

const MAX_RECENT = 10;
// Storage key for the local machine; ssh aliases never contain ":".
const LOCAL = ":local";

interface Machine {
  key: string;
  host?: SshHost;
}

export default function Command() {
  const { herdrPath, configPath } = getPreferenceValues<Preferences>();
  const machines = useMemo<Machine[]>(
    () => [{ key: LOCAL }, ...parseSshConfig(configPath || "~/.ssh/config").map((host) => ({ key: host.alias, host }))],
    [configPath],
  );
  const byKey = useMemo(() => new Map(machines.map((m) => [m.key, m])), [machines]);

  const { value: pinned = [], setValue: setPinned, isLoading: pinnedLoading } = useLocalStorage<string[]>("pinned", []);
  const { value: recent = [], setValue: setRecent, isLoading: recentLoading } = useLocalStorage<string[]>("recent", []);
  const {
    value: sessions = {},
    setValue: setSessions,
    isLoading: sessionsLoading,
  } = useLocalStorage<Record<string, string>>("sessions", {});

  const isLoading = pinnedLoading || recentLoading || sessionsLoading;

  const pinnedMachines = pinned.map((k) => byKey.get(k)).filter((m): m is Machine => !!m);
  const recentMachines = recent
    .filter((k) => !pinned.includes(k))
    .map((k) => byKey.get(k))
    .filter((m): m is Machine => !!m);
  const otherMachines = machines.filter((m) => !pinned.includes(m.key) && !recentMachines.includes(m));

  async function open(m: Machine, newWindow = false) {
    const alias = m.host?.alias;
    const toast = await showToast({ style: Toast.Style.Animated, title: `Opening Herdr on ${alias ?? "Local"}` });
    try {
      const binary = resolveHerdrBinary(herdrPath);
      const target: Target = { alias };
      if (alias) {
        target.session = sessions[alias];
        if (!target.session) {
          toast.message = "Looking up the remote hostname...";
          target.session = await remoteSessionName(alias);
          await setSessions({ ...sessions, [alias]: target.session });
        }
      }
      await openHerdr(binary, target, { newWindow });
    } catch (error) {
      toast.style = Toast.Style.Failure;
      toast.title = `Failed to open Herdr on ${alias ?? "Local"}`;
      toast.message = error instanceof Error ? error.message : String(error);
      return;
    }
    await toast.hide();
    await setRecent([m.key, ...recent.filter((k) => k !== m.key)].slice(0, MAX_RECENT));
    await closeMainWindow();
  }

  function movePinned(key: string, delta: number) {
    const i = pinned.indexOf(key);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= pinned.length) return;
    const next = [...pinned];
    [next[i], next[j]] = [next[j], next[i]];
    setPinned(next);
  }

  function renderItem(m: Machine, kind: "pinned" | "recent" | "other") {
    const h = m.host;
    const alias = h?.alias;
    const target =
      h && [h.user && `${h.user}@`, h.hostName ?? h.alias, h.port && `:${h.port}`].filter(Boolean).join("");
    const session = alias ? sessions[alias] : "default";
    const isPinned = kind === "pinned";
    const index = pinned.indexOf(m.key);
    return (
      <List.Item
        key={`${kind}-${m.key}`}
        icon={isPinned ? Icon.Pin : kind === "recent" ? Icon.Clock : h ? Icon.Terminal : Icon.Desktop}
        title={alias ?? "Local"}
        subtitle={target}
        keywords={[h?.hostName, h?.user].filter((k): k is string => !!k)}
        accessories={session ? [{ tag: session, tooltip: "Herdr session" }] : []}
        actions={
          <ActionPanel>
            <Action title="Open Herdr" icon={Icon.Terminal} onAction={() => open(m)} />
            <Action
              title="Open in New Window"
              icon={Icon.AppWindow}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
              onAction={() => open(m, true)}
            />
            <Action
              title={isPinned ? "Unpin" : "Pin"}
              icon={isPinned ? Icon.PinDisabled : Icon.Pin}
              shortcut={Keyboard.Shortcut.Common.Pin}
              onAction={() => setPinned(isPinned ? pinned.filter((k) => k !== m.key) : [...pinned, m.key])}
            />
            {isPinned && index > 0 && (
              <Action
                title="Move up in Pinned"
                icon={Icon.ArrowUp}
                shortcut={Keyboard.Shortcut.Common.MoveUp}
                onAction={() => movePinned(m.key, -1)}
              />
            )}
            {isPinned && index < pinned.length - 1 && (
              <Action
                title="Move Down in Pinned"
                icon={Icon.ArrowDown}
                shortcut={Keyboard.Shortcut.Common.MoveDown}
                onAction={() => movePinned(m.key, 1)}
              />
            )}
            {kind === "recent" && (
              <Action
                title="Remove from Recent"
                icon={Icon.XMarkCircle}
                style={Action.Style.Destructive}
                shortcut={Keyboard.Shortcut.Common.Remove}
                onAction={() => setRecent(recent.filter((k) => k !== m.key))}
              />
            )}
            <Action.CopyToClipboard
              title="Copy Herdr Command"
              content={["herdr", ...herdrArgs({ alias, session: alias && sessions[alias] })].join(" ")}
            />
            {alias && sessions[alias] && (
              <Action
                title="Forget Session Name"
                icon={Icon.ArrowClockwise}
                onAction={() => setSessions(Object.fromEntries(Object.entries(sessions).filter(([a]) => a !== alias)))}
              />
            )}
            <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search machines...">
      {/* Render items only after storage loads, so the initial selection lands on the first pinned machine. */}
      {!isLoading && (
        <>
          <List.Section title="Pinned">{pinnedMachines.map((m) => renderItem(m, "pinned"))}</List.Section>
          <List.Section title="Recent">{recentMachines.map((m) => renderItem(m, "recent"))}</List.Section>
          <List.Section title="All Machines">{otherMachines.map((m) => renderItem(m, "other"))}</List.Section>
        </>
      )}
    </List>
  );
}
