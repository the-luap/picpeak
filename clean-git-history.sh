#!/bin/bash

# Script to clean git history - removes all commits before July 17, 2025
# WARNING: This is destructive and will rewrite history!

set -e

echo "⚠️  WARNING: This script will permanently rewrite git history!"
echo "⚠️  All commits before July 17, 2025 will be removed."
echo "⚠️  This action cannot be undone!"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to proceed): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Operation cancelled."
    exit 1
fi

# Create backup branch
echo "Creating backup branch..."
git checkout -b backup-before-cleanup-$(date +%Y%m%d-%H%M%S)
git checkout main

# Find the first commit on or after July 17, 2025
echo "Finding first commit after July 17, 2025..."
FIRST_COMMIT=$(git log --since="2025-07-17" --reverse --format="%H" | head -1)

if [ -z "$FIRST_COMMIT" ]; then
    echo "ERROR: No commits found after July 17, 2025"
    exit 1
fi

echo "First commit to keep: $FIRST_COMMIT"
echo "Commit details: $(git log --oneline -1 $FIRST_COMMIT)"

# Get all commits we want to keep
COMMITS_TO_KEEP=$(git log --since="2025-07-17" --reverse --format="%H")
COMMIT_COUNT=$(echo "$COMMITS_TO_KEEP" | wc -l)
echo "Total commits to preserve: $COMMIT_COUNT"

# Create new orphan branch
echo "Creating new clean history..."
git checkout --orphan new-main

# Clean the working directory
git rm -rf . || true

# Get the tree from the first commit
git checkout $FIRST_COMMIT -- .

# Create new initial commit with same content but new message
ORIGINAL_MESSAGE=$(git log --format="%B" -1 $FIRST_COMMIT)
ORIGINAL_AUTHOR=$(git log --format="%an <%ae>" -1 $FIRST_COMMIT)
ORIGINAL_DATE=$(git log --format="%ad" -1 $FIRST_COMMIT)

GIT_AUTHOR_NAME=$(echo "$ORIGINAL_AUTHOR" | cut -d'<' -f1 | xargs)
GIT_AUTHOR_EMAIL=$(echo "$ORIGINAL_AUTHOR" | cut -d'<' -f2 | cut -d'>' -f1)
GIT_AUTHOR_DATE="$ORIGINAL_DATE"
export GIT_AUTHOR_NAME GIT_AUTHOR_EMAIL GIT_AUTHOR_DATE

git add -A
git commit -m "Initial commit - Project start (July 17, 2025)

Original: $ORIGINAL_MESSAGE"

# Cherry-pick remaining commits
echo "Applying remaining commits..."
REMAINING_COMMITS=$(git log --since="2025-07-17" --reverse --format="%H" $FIRST_COMMIT..main)

if [ -n "$REMAINING_COMMITS" ]; then
    for commit in $REMAINING_COMMITS; do
        echo "Applying: $(git log --oneline -1 $commit)"
        git cherry-pick $commit || {
            echo "ERROR: Failed to cherry-pick $commit"
            echo "You may need to resolve conflicts and continue manually"
            exit 1
        }
    done
fi

echo ""
echo "✅ New history created successfully!"
echo "Total commits in new history: $(git rev-list --count HEAD)"
echo ""
echo "To finalize the cleanup, run these commands:"
echo "  git branch -D main"
echo "  git branch -m main"
echo "  git push origin main --force"
echo ""
echo "⚠️  WARNING: Force pushing will overwrite the remote repository!"
echo "⚠️  Make sure you have a backup and all team members are aware!"