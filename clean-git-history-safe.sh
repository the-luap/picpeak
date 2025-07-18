#!/bin/bash

# Script to clean git history - removes all commits before July 17, 2025
# Safe version: Moves current main to main-old and creates new clean main
# WARNING: This will rewrite history!

set -e

echo "⚠️  WARNING: This script will rewrite git history!"
echo "⚠️  All commits before July 17, 2025 will be removed."
echo "⚠️  Current main branch will be preserved as main-old"
echo ""
read -p "Are you sure you want to continue? (type 'yes' to proceed): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Operation cancelled."
    exit 1
fi

# Check current state
CURRENT_BRANCH=$(git branch --show-current)
echo "Current branch: $CURRENT_BRANCH"

# Check if we're in the middle of a cherry-pick or rebase
if [ -d ".git/CHERRY_PICK_HEAD" ] || [ -d ".git/rebase-merge" ] || [ -d ".git/rebase-apply" ]; then
    echo "ERROR: You're in the middle of a cherry-pick or rebase. Please resolve or abort it first."
    echo "To abort cherry-pick: git cherry-pick --abort"
    echo "To abort rebase: git rebase --abort"
    exit 1
fi

# Clean any previous attempts
echo "Cleaning up any previous attempts..."
git cherry-pick --abort 2>/dev/null || true
git rebase --abort 2>/dev/null || true

# Check if main-old already exists
if git show-ref --verify --quiet refs/heads/main-old; then
    echo ""
    echo "⚠️  Branch 'main-old' already exists!"
    echo "Options:"
    echo "1. Delete it and continue (previous backup will be lost)"
    echo "2. Rename it with timestamp and continue"
    echo "3. Cancel operation"
    read -p "Choose option (1/2/3): " option
    
    case $option in
        1)
            echo "Deleting existing main-old branch..."
            git branch -D main-old
            ;;
        2)
            TIMESTAMP=$(date +%Y%m%d-%H%M%S)
            NEW_NAME="main-old-${TIMESTAMP}"
            echo "Renaming existing main-old to ${NEW_NAME}..."
            git branch -m main-old "${NEW_NAME}"
            ;;
        3)
            echo "Operation cancelled."
            exit 1
            ;;
        *)
            echo "Invalid option. Operation cancelled."
            exit 1
            ;;
    esac
fi

# Make sure we're on main branch
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "Switching to main branch..."
    git checkout main
fi

# Move current main to main-old
echo "Moving current main branch to main-old..."
git branch -m main main-old

# Find the first commit on or after July 17, 2025
echo "Finding first commit after July 17, 2025..."
FIRST_COMMIT=$(git log --since="2025-07-17" --reverse --format="%H" | head -1)

if [ -z "$FIRST_COMMIT" ]; then
    echo "ERROR: No commits found after July 17, 2025"
    # Restore main branch
    git branch -m main-old main
    exit 1
fi

echo "First commit to keep: $FIRST_COMMIT"
echo "Commit details: $(git log --oneline -1 $FIRST_COMMIT)"

# Count total commits to process
TOTAL_COMMITS=$(git log --since="2025-07-17" --oneline | wc -l)
echo "Total commits to preserve: $TOTAL_COMMITS"

# Create new orphan branch for clean main
echo "Creating new clean main branch..."
git checkout --orphan main

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

# Now rebase the rest of the history onto the new main
echo "Rebasing remaining commits..."
echo "This will linearize the history (merge commits will be flattened)..."

# Use rebase to apply all commits
git rebase --onto main $FIRST_COMMIT main-old || {
    echo ""
    echo "⚠️  Rebase encountered conflicts!"
    echo ""
    echo "To resolve:"
    echo "1. Fix the conflicts in the listed files"
    echo "2. Stage the resolved files: git add <files>"
    echo "3. Continue rebase: git rebase --continue"
    echo "4. If you want to abort and restore: git rebase --abort && git branch -D main && git branch -m main-old main"
    echo ""
    echo "After successful rebase, your main branch will have the clean history."
    echo "The old history is preserved in main-old branch."
    exit 1
}

# If we get here, rebase was successful
echo ""
echo "✅ New clean history created successfully!"
echo "Total commits in new history: $(git rev-list --count HEAD)"
echo ""
echo "Branch status:"
echo "  - main: Clean history starting from July 17, 2025"
echo "  - main-old: Original history with all commits"
echo ""
echo "To push the new history to remote, run:"
echo "  git push origin main --force"
echo ""
echo "To also push the old history backup:"
echo "  git push origin main-old"
echo ""
echo "⚠️  WARNING: Force pushing will overwrite the remote repository!"
echo "⚠️  Make sure all team members are aware before pushing!"
echo ""
echo "If you need to restore the original history:"
echo "  git checkout main-old"
echo "  git branch -D main"
echo "  git branch -m main"