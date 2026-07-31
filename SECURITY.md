# Security

Please report suspected vulnerabilities through GitHub's private vulnerability reporting for this repository. Do not include sensitive details in a public issue.

Applications are responsible for keeping provider credentials, raw protocol payloads, local paths, command arguments, and unreviewed transcript content outside browser and synchronization projections. This package does not persist those values automatically.

A durable mutation fingerprint must not disclose the effect identity. Prefer an opaque identifier or a keyed digest with an application-owned secret. A plain deterministic hash of low-entropy input is guessable and remains sensitive. Do not place raw user input, credentials, or provider payloads in the fingerprint field. An attempt-ID collision with a different operation, source, or fingerprint must fail closed.

A lost response from a non-idempotent mutation is ambiguous. Applications must reconcile it against an authority or require manual review. They must not retry it merely because a transport disconnected.

Security fixes target the latest version tag. Maintainers will coordinate disclosure and publish a new immutable tag when a fix is ready.
