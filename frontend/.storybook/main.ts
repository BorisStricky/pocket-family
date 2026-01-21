// frontend/.storybook/main.ts
import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx|js|jsx|mjs)"],
  addons: ["@storybook/addon-essentials", "@chromatic-com/storybook"],
  framework: {
    name: "@storybook/react-vite",
    options: {}
  },
  docs: {},
  staticDirs: ["../public"],

  // Ensure Vite pre-bundles and doesn't externalize ESM-only AG Grid packages
  async viteFinal(config, { configType }) {
    return {
      ...config,
      optimizeDeps: {
        ...(config.optimizeDeps || {}),
        include: [
          ...(config.optimizeDeps?.include || []),
          "ag-grid-community",
          "ag-grid-react"
        ],
      },
      ssr: {
        ...(config.ssr || {}),
        noExternal: [
          ...(config.ssr?.noExternal || []),
          "ag-grid-community",
          "ag-grid-react"
        ],
      },
    };
  },
};

export default config;
