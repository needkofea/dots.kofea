import { App, Astal, Gtk, Gdk } from "astal/gtk3";
import Apps from "gi://AstalApps";

import { bind, Variable } from "astal";
import Hyprland from "gi://AstalHyprland";
import app from "astal/gtk3/app";
import Console from "console";

const apps = new Apps.Apps({
  nameMultiplier: 2,
  entryMultiplier: 1,
  executableMultiplier: 2,
  min_score: -1,
});

const hypr = Hyprland.get_default();

const hyprclients_raw = Variable<Hyprland.Client[]>([]).poll(
  200,
  () => hypr.clients,
);

let oldMonitorAppsHash: number = -1;

const hyprclients = Variable<Hyprland.Client[]>([]);
hyprclients_raw.subscribe((newValue: Hyprland.Client[]) => {
  const current = [...hyprclients.get()];

  if (newValue.length != current.length) {
    hyprclients.set(newValue);
    return;
  }

  const new_hash = newValue
    .map((x) => (x.get_pid() + 1) * (x.monitor.id + 1) * (x.workspace.id + 1))
    .reduce((prev, current) => prev * current, 1);
  const old_hash = oldMonitorAppsHash;

  oldMonitorAppsHash = new_hash;
  if (new_hash != old_hash) {
    hyprclients.set(newValue);
    return;
  }
});

export type TaskbarProps = {
  gdkmonitor: Gdk.Monitor;
};

function find_app_by_wmclass(wmclass: string): Apps.Application | null {
  const match = apps
    .get_list()
    .find(
      (x) => x.wm_class == wmclass || x.name == wmclass || x.entry == wmclass,
    );

  return match ?? apps.fuzzy_query(wmclass)[0];
}

export default function Taskbar({ gdkmonitor }: TaskbarProps) {
  const clients = bind(hyprclients).as((clients: Hyprland.Client[]) =>
    clients.filter((x) => x.monitor.get_x() == gdkmonitor.get_geometry().x),
  );

  return (
    <box
      className="container taskbar"
      halign={Gtk.Align.CENTER}
      visible={clients.as((x) => x.length > 0)}
    >
      <box className="content" halign={Gtk.Align.CENTER}>
        {clients.as((clients: Hyprland.Client[]) =>
          clients
            .map((x) => ({
              client: x,
              desktop: find_app_by_wmclass(x.class),
            }))
            .sort((a, b) => a.client.workspace.id - b.client.workspace.id)
            .map(({ client, desktop }) => (
              <button
                className={bind(hypr, "focusedClient").as((a) =>
                  ["dock-item", a?.pid == client?.pid ? "focused" : ""].join(
                    " ",
                  ),
                )}
                onButtonPressEvent={() => client.focus()}
              >
                <box>
                  <icon icon={desktop?.iconName}></icon>
                  <label
                    label={desktop?.name}
                    valign={Gtk.Align.CENTER}
                  ></label>
                </box>
              </button>
            )),
        )}
      </box>
    </box>
  );
}
