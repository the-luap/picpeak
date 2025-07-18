#!/bin/bash

# Script to clean git history - removes all commits before July 17, 2025
# Version 2: Handles merge commits properly
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

# Check current state
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if we're in the middle of a cherry-pick
if [ -d ".git/CHERRY_PICK_HEAD" ]; then
    echo "ERROR: You're in the middle of a cherry-pick. Please resolve or abort it first."
    echo "To abort: git cherry-pick --abort"
    echo "To continue: git cherry-pick --continue"
    exit 1
fi

# Clean any previous attempts
echo "Cleaning up any previous attempts..."
git cherry-pick --abort 2>/dev/null || true
git checkout main 2>/dev/null || true
git branch -D new-main 2>/dev/null || true

# Create backup branch
echo "Creating backup branch..."
BACKUP_BRANCH="backup-before-cleanup-$(date +%Y%m%d-%H%M%S)"
git checkout -b "$BACKUP_BRANCH"
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

# Count total commits to process
TOTAL_COMMITS=$(git log --since="2025-07-17" --oneline | wc -l)
echo "Total commits to preserve: $TOTAL_COMMITS"

# Create new orphan branch
echo "Creating new clean history..."
git checkout --orphan new-main

# Clean the working directory
git rm -rf . || true

# Get the tree from the first commit
git checkout $FIRST_COMMIT -- .

# Create new initial commit with same content
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

# Now we'll use git rebase instead of cherry-pick to handle merges better
echo "Rebasing remaining commits..."
echo "This will linearize the history (merge commits will be flattened)..."

# Get the commit range
LAST_COMMIT=$(git rev-parse main)

# Use rebase to apply all commits
git rebase --onto new-main $FIRST_COMMIT main || {
    echo ""
    echo "⚠️  Rebase encountered conflicts!"
    echo ""
    echo "To resolve:"
    echo "1. Fix the conflicts in the listed files"
    echo "2. Stage the resolved files: git add <files>"
    echo "3. Continue rebase: git rebase --continue"
    echo "4. If you want to abort: git rebase --abort"
    echo ""
    echo "After successful rebase, run:"
    echo "  git branch -D main"
    echo "  git branch -m main"
    echo "  git push origin main --force"
    exit 1
}

# If we get here, rebase was successful
echo ""
echo "✅ New history created successfully!"
echo "Total commits in new history: $(git rev-list --count HEAD)"
echo ""
echo "Your backup branch is: $BACKUP_BRANCH"
echo ""
echo "To finalize the cleanup, run these commands:"
echo "  git branch -D main"
echo "  git branch -m main"
echo "  git push origin main --force"
echo ""
echo "⚠️  WARNING: Force pushing will overwrite the remote repository!"
echo "⚠️  Make sure you have a backup and all team members are aware!"