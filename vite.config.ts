import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { GovernanceReporter } from './src/core/governance/test-harness';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    reporters: ['default', new GovernanceReporter()],
    testTimeout: 40_000,
  },
});
