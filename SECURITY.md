# Security

Codex App SDK is retired. No version receives security fixes, and no new release is planned. Existing consumers should migrate the needed code into their product boundary or maintain their own reviewed fork before relying on it.

GitHub's private vulnerability reporting remains available for responsible disclosure, but a report does not imply a response, fix, or release. Do not include sensitive details in a public issue.

Applications are responsible for keeping provider credentials, raw protocol payloads, local paths, command arguments, and unreviewed transcript content outside browser and synchronization projections. This package does not persist those values automatically.

A durable mutation fingerprint must not disclose the effect identity. Prefer an opaque identifier or a keyed digest with an application-owned secret. A plain deterministic hash of low-entropy input is guessable and remains sensitive. Do not place raw user input, credentials, or provider payloads in the fingerprint field. An attempt-ID collision with a different operation, source, or fingerprint must fail closed.

A lost response from a non-idempotent mutation is ambiguous. Applications must reconcile it against an authority or require manual review. They must not retry it merely because a transport disconnected.
