import type { Plugin, PluginModule } from "@opencode-ai/plugin";
import { loadOptions } from "./options.js";

const server: Plugin = async (_input, pluginOptions) => {
  const { options, warnings } = loadOptions({ pluginOptions });
  for (const warning of warnings) console.warn(`[conditional-instructions] ${warning}`);
  if (!options.enabled) return {};

  // TODO: FR-1 ~ FR-8 구현
  return {};
};

const plugin: PluginModule = {
  id: "conditional-instructions",
  server,
};

export default plugin;
