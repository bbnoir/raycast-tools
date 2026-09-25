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
import { parseSshConfig, SshHost } from "./ssh-config";
import { openSsh, TerminalApp } from "./terminal";

interface Preferences {
  terminal: TerminalApp;
  configPath: string;
}

const MAX_RECENT = 10;

export default function Command() {
  const { terminal, configPath } = getPreferenceValues<Preferences>();
  const hosts = useMemo(() => parseSshConfig(configPath || "~/.ssh/config"), [configPath]);
  const byAlias = useMemo(() => new Map(hosts.map((h) => [h.alias, h])), [hosts]);

  const { value: pinned = [], setValue: setPinned, isLoading: pinnedLoading } = useLocalStorage<string[]>("pinned", []);
  const { value: recent = [], setValue: setRecent, isLoading: recentLoading } = useLocalStorage<string[]>("recent", []);

  const isLoading = pinnedLoading || recentLoading;

  const pinnedHosts = pinned.map((a) => byAlias.get(a)).filter((h): h is SshHost => !!h);
  const recentHosts = recent
    .filter((a) => !pinned.includes(a))
    .map((a) => byAlias.get(a))
    .filter((h): h is SshHost => !!h);
  const otherHosts = hosts.filter((h) => !pinned.includes(h.alias) && !recentHosts.includes(h));

  async function connect(alias: string) {
    try {
      await openSsh(alias, terminal);
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: `Failed to open ${terminal === "wezterm" ? "WezTerm" : "Terminal"}`,
        message: "Check that the app is installed, or switch terminal in preferences.",
      });
      return;
    }
    await setRecent([alias, ...recent.filter((a) => a !== alias)].slice(0, MAX_RECENT));
    await closeMainWindow();
  }

  function movePinned(alias: string, delta: number) {
    const i = pinned.indexOf(alias);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= pinned.length) return;
    const next = [...pinned];
    [next[i], next[j]] = [next[j], next[i]];
    setPinned(next);
  }

  function renderItem(h: SshHost, kind: "pinned" | "recent" | "other") {
    const target = [h.user && `${h.user}@`, h.hostName ?? h.alias, h.port && `:${h.port}`].filter(Boolean).join("");
    const isPinned = kind === "pinned";
    const index = pinned.indexOf(h.alias);
    return (
      <List.Item
        key={`${kind}-${h.alias}`}
        icon={isPinned ? Icon.Pin : kind === "recent" ? Icon.Clock : Icon.Terminal}
        title={h.alias}
        subtitle={target}
        keywords={[h.hostName, h.user].filter((k): k is string => !!k)}
        actions={
          <ActionPanel>
            <Action title="Connect" icon={Icon.Terminal} onAction={() => connect(h.alias)} />
            <Action
              title={isPinned ? "Unpin" : "Pin"}
              icon={isPinned ? Icon.PinDisabled : Icon.Pin}
              shortcut={Keyboard.Shortcut.Common.Pin}
              onAction={() => setPinned(isPinned ? pinned.filter((a) => a !== h.alias) : [...pinned, h.alias])}
            />
            {isPinned && index > 0 && (
              <Action
                title="Move up in Pinned"
                icon={Icon.ArrowUp}
                shortcut={Keyboard.Shortcut.Common.MoveUp}
                onAction={() => movePinned(h.alias, -1)}
              />
            )}
            {isPinned && index < pinned.length - 1 && (
              <Action
                title="Move Down in Pinned"
                icon={Icon.ArrowDown}
                shortcut={Keyboard.Shortcut.Common.MoveDown}
                onAction={() => movePinned(h.alias, 1)}
              />
            )}
            {kind === "recent" && (
              <Action
                title="Remove from Recent"
                icon={Icon.XMarkCircle}
                style={Action.Style.Destructive}
                shortcut={Keyboard.Shortcut.Common.Remove}
                onAction={() => setRecent(recent.filter((a) => a !== h.alias))}
              />
            )}
            <Action.CopyToClipboard
              title="Copy SSH Command"
              content={`${terminal === "wezterm" ? "wezterm ssh" : "ssh"} ${h.alias}`}
            />
            <Action title="Open Extension Preferences" icon={Icon.Gear} onAction={openExtensionPreferences} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search SSH hosts...">
      {/* Render items only after pinned/recent load, so the initial selection lands on the first pinned host. */}
      {!isLoading && (
        <>
          <List.EmptyView title="No hosts found" description={`Nothing parsed from ${configPath}`} />
          <List.Section title="Pinned">{pinnedHosts.map((h) => renderItem(h, "pinned"))}</List.Section>
          <List.Section title="Recent">{recentHosts.map((h) => renderItem(h, "recent"))}</List.Section>
          <List.Section title="All Hosts">{otherHosts.map((h) => renderItem(h, "other"))}</List.Section>
        </>
      )}
    </List>
  );
}
