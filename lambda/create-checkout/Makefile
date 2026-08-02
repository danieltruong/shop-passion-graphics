# SAM custom build for CheckoutFunction.
#
# Selected by `Metadata: BuildMethod: makefile` on the function in infra/template.yaml. SAM's
# native Node.js builder shells out to `npm install` and has no yarn workflow at all, so a
# makefile build is the only way this directory can be a yarn workspace. SAM invokes the
# `build-<LogicalId>` target with $(ARTIFACTS_DIR) set to the staging directory it will zip.
#
# This function is a workspace of the root project, and .yarnrc.yml sets
# `nmHoistingLimits: workspaces`, so `yarn install` at the repo root puts this package's
# dependencies in *this* directory's node_modules rather than hoisting them to the root. That
# is what makes the copy below sufficient — and it is why changing that setting would silently
# ship a Lambda with no dependencies.
#
# The install is deliberately NOT run here. `yarn install --immutable` in CI (and locally)
# already produced the tree, and running an install mid-build would either mutate the
# developer's working tree or need network access inside the build step.

ARTIFACT_FILES := index.mjs checkout-core.mjs package.json products.json

build-CheckoutFunction:
	@test -d node_modules || { \
		echo "❌ node_modules/ is missing — run 'yarn install' at the repo root first."; \
		exit 1; \
	}
	@test -f products.json || { \
		echo "❌ products.json is missing — run 'yarn sync:catalog' before 'sam build'."; \
		echo "   The handler validates every submitted price ID against this catalog."; \
		exit 1; \
	}
	cp $(ARTIFACT_FILES) $(ARTIFACTS_DIR)/
	cp -R node_modules $(ARTIFACTS_DIR)/node_modules

.PHONY: build-CheckoutFunction
