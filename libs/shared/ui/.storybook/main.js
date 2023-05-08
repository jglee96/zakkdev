module.exports = {
  core: { builder: 'webpack5' },
  stories: [
    '../src/lib/**/*.stories.mdx',
    '../src/lib/**/*.stories.@(js|jsx|ts|tsx)',
  ],
  addons: ['@storybook/addon-essentials', '@nrwl/react/plugins/storybook'],
  webpackFinal: async (config, { configType }) => {
    // add your own webpack tweaks if needed

    // disable whatever is already set to load SVGs
    config.module.rules
      .filter((rule) => rule.test.test('.svg'))
      .forEach((rule) => (rule.exclude = /\.svg$/i));

    // add SVGR instead
    config.module.rules.push({
      test: /\.svg$/,
      use: [
        {
          loader: 'file-loader',
        },
      ],
    });

    return config;
  },
};

// To customize your webpack configuration you can use the webpackFinal field.
// Check https://storybook.js.org/docs/react/builders/webpack#extending-storybooks-webpack-config
// and https://nx.dev/packages/storybook/documents/custom-builder-configs
