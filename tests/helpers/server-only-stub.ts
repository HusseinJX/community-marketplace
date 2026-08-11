// `server-only` throws on import outside a React Server Component, which is
// exactly what it is for — but vitest runs in plain Node, where every one of
// these modules IS server code. Aliased in vitest.config.ts so a lib can keep
// its server-only guard and still be unit-testable.
export {}
