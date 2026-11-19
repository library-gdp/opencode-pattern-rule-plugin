import type { Plugin, PluginModule } from "@opencode-ai/plugin";
import { createConditionalInstructions } from "./conditional-instructions.js";
import { loadOptions, resolveConfigDir } from "./options.js";

const server: Plugin = async ({ directory }, pluginOptions) => {
  const { options, warnings } = loadOptions({ pluginOptions });
  for (const warning of warnings) console.warn(`[conditional-instructions] ${warning}`);
  if (!options.enabled) return {};

  const engine = createConditionalInstructions({
    // git 저장소 여부와 관계없이 OpenCode를 실행한 디렉터리를 기준으로 삼습니다.
    projectDir: directory,
    configDir: resolveConfigDir(),
    options,
  });

  return {
    "tool.execute.after": async ({ sessionID, tool, args }, output) => {
      const appended = await engine.onToolExecuted({ sessionID, tool, args });
      if (appended) output.output = `${output.output}\n\n${appended}`;
    },
    "experimental.chat.system.transform": async ({ sessionID }, output) => {
      if (sessionID) output.system.push(...(await engine.systemInstructions(sessionID)));
    },
    "experimental.session.compacting": async ({ sessionID }, output) => {
      output.context.push(...(await engine.compactionContext(sessionID)));
    },
    event: async ({ event }) => {
      if (event.type === "session.deleted") engine.forgetSession(event.properties.info.id);
    },
  };
};

const plugin: PluginModule = {
  id: "conditional-instructions",
  server,
};

export default plugin;
