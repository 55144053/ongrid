// Package store is the GORM-backed persistence for the secret vault.
package store

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"

	model "github.com/ongridio/ongrid/internal/manager/model/secret"
	"github.com/ongridio/ongrid/internal/pkg/errs"
)

// Repo is the GORM-backed secrets store. Concurrency-safe.
type Repo struct{ db *gorm.DB }

// NewRepo builds the repo around an opened *gorm.DB.
func NewRepo(db *gorm.DB) *Repo { return &Repo{db: db} }

// Create inserts a new secret. Name must be unique — a duplicate returns
// errs.ErrConflict.
func (r *Repo) Create(ctx context.Context, s *model.Secret) error {
	if s == nil || strings.TrimSpace(s.Name) == "" {
		return fmt.Errorf("%w: name required", errs.ErrInvalid)
	}
	if err := r.db.WithContext(ctx).Create(s).Error; err != nil {
		if isDup(err) {
			return fmt.Errorf("%w: secret %q already exists", errs.ErrConflict, s.Name)
		}
		return err
	}
	return nil
}

// Update sets the value and/or description of an existing secret by id.
// An empty value leaves the stored value untouched (so editing only the
// description doesn't require re-entering the secret).
func (r *Repo) Update(ctx context.Context, id uint64, value, description string) error {
	fields := map[string]any{"description": description}
	if strings.TrimSpace(value) != "" {
		fields["value"] = value
	}
	res := r.db.WithContext(ctx).Model(&model.Secret{}).Where("id = ?", id).Updates(fields)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errs.ErrNotFound
	}
	return nil
}

// Delete removes a secret by id.
func (r *Repo) Delete(ctx context.Context, id uint64) error {
	res := r.db.WithContext(ctx).Where("id = ?", id).Delete(&model.Secret{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errs.ErrNotFound
	}
	return nil
}

// List returns every secret ordered by name. Values are included — callers
// that serve the result over HTTP MUST redact them (the biz layer does).
func (r *Repo) List(ctx context.Context) ([]*model.Secret, error) {
	var out []*model.Secret
	if err := r.db.WithContext(ctx).Order("name ASC").Find(&out).Error; err != nil {
		return nil, err
	}
	return out, nil
}

// ResolveValues returns name→value for the requested names that exist.
// Used only by the in-process injection path (never exposed over HTTP).
// Names with no stored secret are simply absent from the result.
func (r *Repo) ResolveValues(ctx context.Context, names []string) (map[string]string, error) {
	out := map[string]string{}
	if len(names) == 0 {
		return out, nil
	}
	var rows []*model.Secret
	if err := r.db.WithContext(ctx).Where("name IN ?", names).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, s := range rows {
		out[s.Name] = s.Value
	}
	return out, nil
}

// ExistingNames returns the subset of names that have a stored secret —
// lets the install UI show which declared requirements are filled without
// ever shipping the values.
func (r *Repo) ExistingNames(ctx context.Context, names []string) ([]string, error) {
	if len(names) == 0 {
		return nil, nil
	}
	var got []string
	if err := r.db.WithContext(ctx).Model(&model.Secret{}).
		Where("name IN ?", names).Pluck("name", &got).Error; err != nil {
		return nil, err
	}
	return got, nil
}

func isDup(err error) bool {
	if err == nil {
		return false
	}
	if errors.Is(err, gorm.ErrDuplicatedKey) {
		return true
	}
	m := err.Error()
	return strings.Contains(m, "UNIQUE") || strings.Contains(m, "Duplicate") || strings.Contains(m, "duplicate")
}
