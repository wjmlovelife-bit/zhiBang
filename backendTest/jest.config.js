/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts', '**/*.e2e-spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  moduleNameMapper: {
    '^@app/(.*)$': '<rootDir>/../backend/src/$1',
  },
  // 让 jest 解析时优先找 backend/node_modules（共享依赖）
  modulePaths: ['<rootDir>/../backend/node_modules', '<rootDir>/node_modules'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },
  collectCoverageFrom: [
    '../backend/src/**/*.service.ts',
    '../backend/src/modules/auth/**/*.ts',
    '../backend/src/modules/sys/**/*.ts',
    '../backend/src/modules/customer/**/*.ts',
    '../backend/src/modules/project/**/*.ts',
  ],
  coverageDirectory: './coverage',
  coverageReporters: ['text', 'html'],
  testTimeout: 30000,
  maxWorkers: 1,
  setupFiles: ['<rootDir>/src/setup/jest.setup.ts'],
};
