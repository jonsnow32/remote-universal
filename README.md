# Universal Remote Platform

A production-ready monorepo for a **Universal Remote Control Platform** built with React Native + Expo. Control TVs, air conditioners, and smart home devices via IR, BLE, Wi-Fi, HomeKit, and Matter — all from a single shared codebase. Generate white-label brand apps (Samsung, LG, Daikin, Sony) with only a theme + device-SDK config change.

---

## Monorepo Structure

```
universal-remote-platform/
├── packages/
│   ├── core/              # @remote/core — protocols, commands, discovery, registry
│   ├── ui-kit/            # @remote/ui-kit — themed components, ThemeProvider
│   ├── device-sdk/        # @remote/device-sdk — Samsung, LG, Daikin device definitions
│   ├── native-modules/    # @remote/native-modules — IR, BLE, HomeKit, Matter bridges
│   └── cloud-sdk/         # @remote/cloud-sdk — auth, sync, OTA, tenant
├── apps/
│   ├── remote-universal/  # Flagship app — all brands merged
│   ├── remote-samsung/    # Samsung white-label (blue #1428A0)
│   ├── remote-lg/         # LG white-label (red #A50034)
│   └── remote-daikin/     # Daikin white-label (blue #005BAC)
└── backend/
    ├── api/               # Fastify REST API
    ├── tenant-service/    # Multi-tenant config service
    ├── device-db/         # Device definition database
    └── ota-service/       # Over-the-air update service
```

---

## Getting Started

```bash
# 1. Install all dependencies
pnpm install

# 2. Start all packages and apps in development mode
pnpm dev
```

---

## Running a Specific App

```bash
# Run only the Samsung white-label app
pnpm --filter remote-samsung dev

# Run only the universal app
pnpm --filter remote-universal dev

# Run the backend API
pnpm --filter @remote/api dev
```

---

## How to Add a New Brand SDK``

Follow these 5 steps to add a new brand (e.g., Sony):

1. **Copy the template**: `cp -r packages/device-sdk/src/_template packages/device-sdk/src/sony`

2. **Add device definitions**: Create files in `packages/device-sdk/src/sony/devices/` that implement the `DeviceDefinition` interface from `@remote/core`.

3. **Add protocol adapters**: Create brand-specific protocol classes in `packages/device-sdk/src/sony/protocols/` by extending `IRProtocol`, `WiFiProtocol`, etc.

4. **Add remote layouts**: Define button layouts in `packages/device-sdk/src/sony/layouts/` using `RemoteLayoutDefinition`.

5. **Export from the SDK**: Add exports to `packages/device-sdk/src/sony/index.ts` and register the new brand in `packages/device-sdk/src/index.ts`.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | ✅ |
| `SUPABASE_ANON_KEY` | Supabase anonymous API key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (backend only) | ✅ |
| `EXPO_TOKEN` | Expo EAS authentication token | ✅ for CI/CD |
| `SAMSUNG_SMARTTHINGS_API_KEY` | Samsung SmartThings API key | Optional |
| `LG_THINQ_ACCESS_TOKEN` | LG ThinQ OAuth access token | Optional |
| `DAIKIN_CLOUD_ACCESS_TOKEN` | Daikin Onecta API access token | Optional |
| `MQTT_BROKER_URL` | MQTT broker URL for device sync | Optional |
| `MQTT_USERNAME` | MQTT broker username | Optional |
| `MQTT_PASSWORD` | MQTT broker password | Optional |

---

## Architecture

- **Turborepo + pnpm workspaces** for monorepo orchestration
- **`@remote/core`** — abstract protocol layer with retry logic, command queue, macro engine, and device registry
- **`@remote/ui-kit`** — brand-agnostic React Native component library with `ThemeProvider`
- **`@remote/device-sdk`** — concrete device definitions per brand
- **`@remote/native-modules`** — thin JS wrappers over native IR/BLE/HomeKit/Matter APIs
- **`@remote/cloud-sdk`** — Supabase-backed auth, sync, OTA, and multi-tenant config

## Contributing

1. Fork the repository and create a feature branch
2. Run `pnpm install` and `pnpm dev` to verify setup
3. Run `pnpm lint` and `pnpm test` before submitting a PR
4. Follow the TypeScript strict mode conventions (`noImplicitAny`, `strictNullChecks`)
5. Use named exports for all types and interfaces (no default exports except React components)

## License

MIT © Universal Remote Platform Contributors
