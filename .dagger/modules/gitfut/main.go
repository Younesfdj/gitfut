// GitFut as a Dagger module: build the Next.js app, run it as a service, and
// scout GitHub profiles into FIFA-style card PNGs.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"dagger/gitfut/internal/dagger"
)

type Gitfut struct {
	// GitHub token used both to identify the caller and to let the app query
	// the GitHub GraphQL API.
	// +private
	GhToken *dagger.Secret
}

func New(
	// GitHub token (e.g. --gh-token cmd://"gh auth token")
	ghToken *dagger.Secret,
) *Gitfut {
	return &Gitfut{GhToken: ghToken}
}

// Gitfut returns the generated card PNG for the given username, defaulting to
// the user that owns the GitHub token.
func (m *Gitfut) Gitfut(
	ctx context.Context,
	// +defaultPath="/"
	// +ignore=["node_modules", ".next", ".git", ".dagger", "dagger.toml", "dagger.lock"]
	source *dagger.Directory,
	// GitHub username to scout; defaults to the token's owner
	// +optional
	username string,
) (*dagger.File, error) {
	if username == "" {
		login, err := m.tokenLogin(ctx)
		if err != nil {
			return nil, err
		}
		username = login
	}

	return dag.Container().
		From("curlimages/curl:8.14.1").
		WithServiceBinding("gitfut", m.App(source)).
		// The card is scouted from live GitHub stats — never serve a stale one.
		WithEnvVariable("CACHE_BUSTER", time.Now().String()).
		WithExec([]string{
			"curl", "-fsSL", "--retry", "5", "--retry-connrefused", "--retry-delay", "2",
			"-o", "/tmp/card.png", fmt.Sprintf("http://gitfut:3000/%s.png", username),
		}).
		File("/tmp/card.png"), nil
}

// App builds the Next.js app and returns it as a service on port 3000.
func (m *Gitfut) App(
	// +defaultPath="/"
	// +ignore=["node_modules", ".next", ".git", ".dagger", "dagger.toml", "dagger.lock"]
	source *dagger.Directory,
) *dagger.Service {
	return m.build(source).
		WithSecretVariable("GITHUB_TOKEN", m.GhToken).
		WithExposedPort(3000).
		AsService(dagger.ContainerAsServiceOpts{Args: []string{"npm", "start"}})
}

func (m *Gitfut) build(source *dagger.Directory) *dagger.Container {
	return dag.Container().
		From("node:24-alpine").
		WithWorkdir("/app").
		WithMountedCache("/root/.npm", dag.CacheVolume("gitfut-npm")).
		// Install deps off package files only, so code edits don't bust the layer.
		WithFile("package.json", source.File("package.json")).
		WithFile("package-lock.json", source.File("package-lock.json")).
		WithExec([]string{"npm", "ci"}).
		WithDirectory(".", source).
		WithExec([]string{"npm", "run", "build"})
}

// tokenLogin resolves the GitHub login that owns the token.
func (m *Gitfut) tokenLogin(ctx context.Context) (string, error) {
	out, err := dag.Container().
		From("curlimages/curl:8.14.1").
		WithSecretVariable("GITHUB_TOKEN", m.GhToken).
		WithExec([]string{"sh", "-c",
			`curl -fsSL -H "Authorization: Bearer $GITHUB_TOKEN" https://api.github.com/user`,
		}).
		Stdout(ctx)
	if err != nil {
		return "", fmt.Errorf("resolving token owner: %w", err)
	}
	var user struct {
		Login string `json:"login"`
	}
	if err := json.Unmarshal([]byte(out), &user); err != nil {
		return "", fmt.Errorf("parsing github /user response: %w", err)
	}
	if user.Login == "" {
		return "", fmt.Errorf("github /user returned no login")
	}
	return user.Login, nil
}
