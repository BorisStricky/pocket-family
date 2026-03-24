import React from "react";
import { ComponentMeta, ComponentStory } from "@storybook/react";
import { ThemeProvider } from "@mui/material/styles";
import Stack from "@mui/material/Stack";
import { Button } from "../components/atoms";
import theme from "../theme";

export default {
  title: "Atoms/Button",
  component: Button,
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <div style={{ padding: 24 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  argTypes: {
    variant: {
      control: { type: "select" },
      options: ["primary", "secondary", "ghost"],
    },
    size: {
      control: { type: "select" },
      options: ["small", "medium", "large"],
    },
    loading: { control: "boolean" },
    fullWidth: { control: "boolean" },
  },
} as ComponentMeta<typeof Button>;

const Template: ComponentStory<typeof Button> = (args) => (
  <Stack spacing={2} direction="column">
    <div style={{ display: "flex", gap: 12 }}>
      <Button {...args}>Default</Button>
      <Button {...args} variant="secondary">
        Secondary
      </Button>
      <Button {...args} variant="ghost">
        Ghost
      </Button>
    </div>
    <div style={{ display: "flex", gap: 12 }}>
      <Button {...args} size="small">
        Small
      </Button>
      <Button {...args} size="medium">
        Medium
      </Button>
      <Button {...args} size="large">
        Large
      </Button>
    </div>
  </Stack>
);

export const Playground = Template.bind({});
Playground.args = {
  variant: "primary",
  size: "medium",
  loading: false,
  fullWidth: false,
};
