import {
  Action,
  ActionPanel,
  Alert,
  Color,
  confirmAlert,
  Form,
  getPreferenceValues,
  Icon,
  Keyboard,
  LaunchProps,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { createDeeplink, FormValidation, useForm } from "@raycast/utils";
import { randomUUID } from "node:crypto";
import { useEffect, useMemo, useState } from "react";
import { parseSshConfig } from "./ssh-config";
import { listener, loadWebPages, openWebPage, pageUrl, saveWebPages, sshArgs, stopTunnel, WebPage } from "./web-tunnel";

interface Preferences {
  configPath: string;
}

// Quicklinks created from this command launch it with the page id to open.
export default function Command(props: LaunchProps<{ launchContext: { pageId?: string } }>) {
  const [pages, setPages] = useState(loadWebPages);
  const [connected, setConnected] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    const entries = await Promise.all(
      pages.map(async (p) => [p.id, (await listener(p.localPort))?.command === "ssh"] as const),
    );
    setConnected(Object.fromEntries(entries));
    setIsLoading(false);
  }

  useEffect(() => {
    refresh();
  }, [pages]);

  useEffect(() => {
    const page = pages.find((p) => p.id === props.launchContext?.pageId);
    if (page) openWebPage(page);
  }, []);

  function update(next: WebPage[]) {
    saveWebPages(next);
    setPages(next);
  }

  function upsert(page: WebPage) {
    update(pages.some((p) => p.id === page.id) ? pages.map((p) => (p.id === page.id ? page : p)) : [...pages, page]);
  }

  async function remove(page: WebPage) {
    const ok = await confirmAlert({
      title: `Delete "${page.name}"?`,
      primaryAction: { title: "Delete", style: Alert.ActionStyle.Destructive },
    });
    if (ok) update(pages.filter((p) => p.id !== page.id));
  }

  async function close(page: WebPage) {
    const stopped = await stopTunnel(page);
    await showToast({
      style: stopped ? Toast.Style.Success : Toast.Style.Failure,
      title: stopped ? "Tunnel closed" : "No ssh tunnel on this port",
    });
    refresh();
  }

  const addAction = (
    <Action.Push
      title="Add Web Page"
      icon={Icon.Plus}
      shortcut={Keyboard.Shortcut.Common.New}
      target={<WebPageForm onSubmit={upsert} />}
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search web pages...">
      <List.EmptyView
        title="No web pages"
        description="Add a page served on an SSH host, opened through a local tunnel"
        actions={<ActionPanel>{addAction}</ActionPanel>}
      />
      {pages.map((p) => (
        <List.Item
          key={p.id}
          icon={Icon.Globe}
          title={p.name}
          subtitle={`${p.host} · :${p.localPort} → ${p.remoteHost}:${p.remotePort}`}
          keywords={[p.host, String(p.localPort)]}
          accessories={[
            ...(connected[p.id] ? [{ tag: { value: "Connected", color: Color.Green } }] : []),
            {
              icon: Icon.Clock,
              text: p.idleMinutes > 0 ? `${p.idleMinutes} min` : "never",
              tooltip: "Auto-close after this long without connections",
            },
          ]}
          actions={
            <ActionPanel>
              <Action title="Open" icon={Icon.Globe} onAction={() => openWebPage(p)} />
              <Action.Push
                title="Edit"
                icon={Icon.Pencil}
                shortcut={Keyboard.Shortcut.Common.Edit}
                target={<WebPageForm page={p} onSubmit={upsert} />}
              />
              {addAction}
              {connected[p.id] && (
                <Action
                  title="Close Tunnel"
                  icon={Icon.Plug}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "w" }}
                  onAction={() => close(p)}
                />
              )}
              <Action.CreateQuicklink
                title="Create Quicklink"
                quicklink={{
                  name: p.name,
                  link: createDeeplink({ command: "web-pages", context: { pageId: p.id } }),
                }}
              />
              <Action.CopyToClipboard title="Copy URL" content={pageUrl(p)} />
              <Action.CopyToClipboard title="Copy SSH Command" content={`ssh ${sshArgs(p).join(" ")}`} />
              <Action
                title="Delete"
                icon={Icon.Trash}
                style={Action.Style.Destructive}
                shortcut={Keyboard.Shortcut.Common.Remove}
                onAction={() => remove(p)}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

interface FormValues {
  name: string;
  host: string;
  sshPort: string;
  localPort: string;
  remoteHost: string;
  remotePort: string;
  idleMinutes: string;
}

function portError(v?: string): string | undefined {
  if (!v) return "Required";
  return /^\d+$/.test(v) && +v > 0 && +v < 65536 ? undefined : "Enter a port (1–65535)";
}

function WebPageForm({ page, onSubmit }: { page?: WebPage; onSubmit: (p: WebPage) => void }) {
  const { pop } = useNavigation();
  const { configPath } = getPreferenceValues<Preferences>();
  const hosts = useMemo(() => parseSshConfig(configPath || "~/.ssh/config").map((h) => h.alias), [configPath]);
  if (page && !hosts.includes(page.host)) hosts.unshift(page.host);

  const { handleSubmit, itemProps } = useForm<FormValues>({
    initialValues: {
      name: page?.name ?? "",
      host: page?.host ?? hosts[0],
      sshPort: page?.sshPort ? String(page.sshPort) : "",
      localPort: page ? String(page.localPort) : "",
      remoteHost: page?.remoteHost ?? "localhost",
      remotePort: page ? String(page.remotePort) : "",
      idleMinutes: String(page?.idleMinutes ?? 10),
    },
    validation: {
      name: FormValidation.Required,
      host: FormValidation.Required,
      sshPort: (v) => (v ? portError(v) : undefined),
      localPort: portError,
      remoteHost: FormValidation.Required,
      remotePort: portError,
      idleMinutes: (v) => (v && /^\d+$/.test(v) ? undefined : "Enter minutes (0 = never)"),
    },
    onSubmit(v) {
      onSubmit({
        id: page?.id ?? randomUUID(),
        name: v.name.trim(),
        host: v.host,
        sshPort: v.sshPort ? Number(v.sshPort) : undefined,
        localPort: Number(v.localPort),
        remoteHost: v.remoteHost.trim(),
        remotePort: Number(v.remotePort),
        idleMinutes: Number(v.idleMinutes),
      });
      pop();
    },
  });

  return (
    <Form
      navigationTitle={page ? `Edit ${page.name}` : "Add Web Page"}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Save" icon={Icon.Check} onSubmit={handleSubmit} />
        </ActionPanel>
      }
    >
      <Form.TextField title="Name" placeholder="Server Dashboard" {...itemProps.name} />
      <Form.Separator />
      <Form.Dropdown title="SSH Host" {...itemProps.host}>
        {hosts.map((h) => (
          <Form.Dropdown.Item key={h} value={h} title={h} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        title="SSH Port"
        placeholder="From ssh config"
        info="Leave empty to use the port from ~/.ssh/config"
        {...itemProps.sshPort}
      />
      <Form.Separator />
      <Form.TextField title="Local Port" placeholder="8211" {...itemProps.localPort} />
      <Form.TextField
        title="Remote Host"
        info="Host to forward to, as seen from the SSH server"
        {...itemProps.remoteHost}
      />
      <Form.TextField title="Remote Port" placeholder="8211" {...itemProps.remotePort} />
      <Form.Separator />
      <Form.TextField
        title="Auto-close (minutes)"
        info="Close the tunnel after this many minutes without connections. 0 keeps it open."
        {...itemProps.idleMinutes}
      />
    </Form>
  );
}
