import { defineConfig } from 'i18next-cli';

export default defineConfig({
  locales: ['en', 'de', 'nl', 'pt', 'ru', 'fr'],

  extract: {
    input: ['src/**/*.{ts,tsx,js,jsx}', '!src/**/*.{test,spec,d}.{ts,tsx}'],
    output: 'src/i18n/locales/{{language}}.json',
    defaultNS: false,

    primaryLanguage: 'en',

    removeUnusedKeys: true,

    // Dynamic keys to preserve (e.g.: t(`errors.${code}`))
    preservePatterns: [],

    preserveContextVariants: true,

    indentation: 2,
    sort:false
  },
});