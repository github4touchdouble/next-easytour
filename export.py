#!/usr/bin/env python3
"""Export a Next.js repository into a single text file for LLM context."""

import os
import argparse
from pathlib import Path

INCLUDE_EXTENSIONS = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".tsv",
    ".css", ".scss", ".module.css",
    ".json", ".yaml", ".yml", ".toml",
    ".md", ".mdx",
    ".env.example", ".env.local.example",
    ".graphql", ".gql", ".prisma", ".sql",
}

INCLUDE_ROOT_FILES = {
    "package.json", "tsconfig.json", "next.config.js", "next.config.mjs",
    "next.config.ts", "tailwind.config.js", "tailwind.config.ts",
    "postcss.config.js", "postcss.config.mjs", ".eslintrc.json",
    "eslint.config.mjs", "middleware.ts", "middleware.js",
    "docker-compose.yml", "Dockerfile", ".env.example",
}

SKIP_DIRS = {
    "node_modules", ".next", ".git", ".vercel", ".turbo",
    "dist", "build", "out", ".cache", "__pycache__",
    "coverage", ".husky", ".swc",
}

SKIP_FILES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
}

MAX_FILE_SIZE = 900_000  # bytes


def should_include(path: Path, root: Path) -> bool:
    if path.name in SKIP_FILES:
        return False
    if path.stat().st_size > MAX_FILE_SIZE:
        return False
    if path.parent == root and path.name in INCLUDE_ROOT_FILES:
        return True
    return path.suffix in INCLUDE_EXTENSIONS


def collect_files(root: Path) -> list[Path]:
    files = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        dirnames.sort()
        for fname in sorted(filenames):
            fpath = Path(dirpath) / fname
            if should_include(fpath, root):
                files.append(fpath)
    return files


def export(root: Path, output: Path, tree_only: bool = False) -> None:
    files = collect_files(root)

    with open(output, "w", encoding="utf-8") as out:
        # Directory tree
        out.write("# Project Structure\n\n```\n")
        for f in files:
            out.write(f"{f.relative_to(root)}\n")
        out.write("```\n\n")

        if tree_only:
            print(f"Tree written to {output} ({len(files)} files)")
            return

        # File contents
        out.write("# File Contents\n\n")
        for f in files:
            rel = f.relative_to(root)
            try:
                content = f.read_text(encoding="utf-8")
            except (UnicodeDecodeError, PermissionError):
                continue
            suffix = f.suffix.lstrip(".")
            out.write(f"## {rel}\n\n```{suffix}\n{content}\n```\n\n")

        size_kb = output.stat().st_size / 1024
        print(f"Exported {len(files)} files to {output} ({size_kb:.0f} KB)")


def main():
    parser = argparse.ArgumentParser(description="Export Next.js repo for LLM context")
    parser.add_argument("repo", nargs="?", default=".", help="Path to repo root (default: .)")
    parser.add_argument("-o", "--output", default="repo_export.txt", help="Output file (default: repo_export.txt)")
    parser.add_argument("--tree-only", action="store_true", help="Export only the file tree, no contents")
    args = parser.parse_args()

    root = Path(args.repo).resolve()
    if not (root / "package.json").exists():
        print(f"Warning: no package.json found in {root}")

    export(root, Path(args.output), args.tree_only)


if __name__ == "__main__":
    main()