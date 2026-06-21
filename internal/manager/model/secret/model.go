// Package secret holds the persistence entity for the generic secret
// store (HLD-017). It is the single, semantics-agnostic credential vault
// that installed skills AND (future) external MCP servers draw from: each
// skill/MCP manifest DECLARES the secret names it needs (metadata.requires.
// env), the operator FILLS them here, and the runtime INJECTS them as
// environment variables into the skill/MCP subprocess at exec time. ongrid
// never hard-codes what a secret means — the manifest owns that.
//
// At-rest posture matches the rest of ongrid (ADR-023): values live in the
// same MySQL as everything else, in cleartext for the private-MVP; the
// `Value` is redacted on every read API. AES-at-rest is a tracked
// hardening follow-up, not an MVP blocker.
package secret

import "time"

// Secret is one named credential value. Name is the injection key — it is
// the exact environment-variable name the consuming skill/MCP expects
// (e.g. "TENCENTCLOUD_SECRET_ID", "GITHUB_TOKEN"), so a manifest's
// requires.env entry binds to a row by name with no extra mapping table.
type Secret struct {
	ID uint64 `gorm:"primaryKey;autoIncrement"`

	// Name is the unique injection key == the env var name the consumer
	// reads. Uppercase-with-underscores by convention but not enforced
	// (some tools want lowercase).
	Name string `gorm:"size:128;not null;uniqueIndex"`

	// Value is the secret material. Cleartext at rest (see package doc);
	// NEVER returned by a list/get API — redacted to "" with HasValue set.
	Value string `gorm:"type:text;not null"`

	// Description is an optional human note ("Tencent Cloud prod secret
	// key for the terraform skill").
	Description string `gorm:"size:512"`

	CreatedAt time.Time `gorm:"autoCreateTime"`
	UpdatedAt time.Time `gorm:"autoUpdateTime"`
}

// TableName pins the schema name across future package renames.
func (Secret) TableName() string { return "secrets" }
