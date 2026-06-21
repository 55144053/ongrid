// Package secret is the biz tier for the generic secret vault (HLD-017).
// It owns redaction (values never leave the process over an API) and the
// in-process Resolve path the skill/MCP injection layer uses.
package secret

import (
	"context"
	"fmt"
	"strings"
	"time"

	model "github.com/ongridio/ongrid/internal/manager/model/secret"
	"github.com/ongridio/ongrid/internal/pkg/errs"
)

// Repo is the persistence contract (data/secret/store).
type Repo interface {
	Create(ctx context.Context, s *model.Secret) error
	Update(ctx context.Context, id uint64, value, description string) error
	Delete(ctx context.Context, id uint64) error
	List(ctx context.Context) ([]*model.Secret, error)
	ResolveValues(ctx context.Context, names []string) (map[string]string, error)
	ExistingNames(ctx context.Context, names []string) ([]string, error)
}

// View is the redacted shape returned to API callers — never the value.
type View struct {
	ID          uint64    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	HasValue    bool      `json:"has_value"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Usecase is the secret-vault facade.
type Usecase struct{ repo Repo }

// NewUsecase wires the repo.
func NewUsecase(repo Repo) *Usecase { return &Usecase{repo: repo} }

// Create stores a new secret. Name is required and unique; value required.
func (u *Usecase) Create(ctx context.Context, name, value, description string) (*View, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, fmt.Errorf("%w: name required", errs.ErrInvalid)
	}
	if strings.TrimSpace(value) == "" {
		return nil, fmt.Errorf("%w: value required", errs.ErrInvalid)
	}
	s := &model.Secret{Name: name, Value: value, Description: strings.TrimSpace(description)}
	if err := u.repo.Create(ctx, s); err != nil {
		return nil, err
	}
	return toView(s), nil
}

// Update changes the value (when non-empty) and/or description.
func (u *Usecase) Update(ctx context.Context, id uint64, value, description string) error {
	return u.repo.Update(ctx, id, value, strings.TrimSpace(description))
}

// Delete removes a secret.
func (u *Usecase) Delete(ctx context.Context, id uint64) error { return u.repo.Delete(ctx, id) }

// List returns all secrets, redacted (value omitted, HasValue set).
func (u *Usecase) List(ctx context.Context) ([]*View, error) {
	rows, err := u.repo.List(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*View, 0, len(rows))
	for _, s := range rows {
		out = append(out, toView(s))
	}
	return out, nil
}

// Resolve returns name→value for the requested names (in-process injection
// only — callers must NOT serialize this over an API). Missing names are
// absent from the result.
func (u *Usecase) Resolve(ctx context.Context, names []string) (map[string]string, error) {
	return u.repo.ResolveValues(ctx, names)
}

// FilledNames reports which of names currently have a stored secret — used
// by the install UI to flag a skill's unmet requires.env without leaking
// any values.
func (u *Usecase) FilledNames(ctx context.Context, names []string) ([]string, error) {
	return u.repo.ExistingNames(ctx, names)
}

func toView(s *model.Secret) *View {
	return &View{
		ID:          s.ID,
		Name:        s.Name,
		Description: s.Description,
		HasValue:    strings.TrimSpace(s.Value) != "",
		CreatedAt:   s.CreatedAt,
		UpdatedAt:   s.UpdatedAt,
	}
}
