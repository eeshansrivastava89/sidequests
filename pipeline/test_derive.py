"""Tests for derive.py scoring and tagging logic."""

import pytest
from derive import (
    derive_status,
    derive_hygiene_score,
    derive_momentum_score,
    derive_health_score,
    derive_tags,
)


# ── derive_status ─────────────────────────────────────────


class TestDeriveStatus:
    @pytest.mark.parametrize(
        "days, expected",
        [
            (0, "active"),
            (14, "active"),
            (15, "completed"),
            (60, "completed"),
            (61, "paused"),
            (180, "paused"),
            (181, "archived"),
            (365, "archived"),
        ],
    )
    def test_boundaries(self, days: int, expected: str) -> None:
        assert derive_status(days) == expected

    def test_none_returns_archived(self) -> None:
        assert derive_status(None) == "archived"


# ── derive_hygiene_score ──────────────────────────────────


class TestDeriveHygieneScore:
    def test_empty_project(self) -> None:
        """An empty project only gets lowTodos (todoCount defaults to 0 < 10)."""
        score, breakdown = derive_hygiene_score({})
        assert breakdown == {"lowTodos": 10}
        # raw=10, normalized = round(10 * 100 / 95) = 11
        assert score == 11

    def test_full_project(self) -> None:
        """A project with every signal maxes out at 100."""
        project = {
            "files": {
                "readme": True,
                "tests": True,
                "linterConfig": True,
                "license": True,
                "lockfile": True,
            },
            "cicd": {"github_actions": True},
            "deployment": {"vercel": True},
            "remoteUrl": "https://github.com/test/test",
            "todoCount": 5,
        }
        score, breakdown = derive_hygiene_score(project)
        assert score == 100
        assert set(breakdown.keys()) == {
            "readme",
            "tests",
            "cicd",
            "remote",
            "lowTodos",
            "deployment",
            "linter",
            "license",
            "lockfile",
        }

    def test_readme_only(self) -> None:
        project = {"files": {"readme": True}, "todoCount": 100}
        score, breakdown = derive_hygiene_score(project)
        assert "readme" in breakdown
        assert breakdown["readme"] == 15
        # No lowTodos because todoCount >= 10
        assert "lowTodos" not in breakdown

    def test_high_todo_count_removes_bonus(self) -> None:
        project = {"todoCount": 15}
        _, breakdown = derive_hygiene_score(project)
        assert "lowTodos" not in breakdown


# ── derive_momentum_score ─────────────────────────────────


class TestDeriveMomentumScore:
    @pytest.mark.parametrize(
        "days, expected_recency",
        [
            (0, 25),
            (7, 25),
            (8, 20),
            (14, 20),
            (15, 15),
            (30, 15),
            (31, 5),
            (60, 5),
            (61, None),  # No recency points
            (90, None),
        ],
    )
    def test_recency_tiers(self, days: int, expected_recency: int | None) -> None:
        project = {"daysInactive": days, "isDirty": True, "ahead": 1, "branchCount": 5}
        _, breakdown = derive_momentum_score(project)
        if expected_recency is not None:
            assert breakdown.get("recency") == expected_recency
        else:
            assert "recency" not in breakdown

    def test_clean_tree_bonus(self) -> None:
        project = {"isDirty": False, "daysInactive": 100}
        _, breakdown = derive_momentum_score(project)
        assert breakdown["cleanTree"] == 20

    def test_dirty_tree_no_bonus(self) -> None:
        project = {"isDirty": True, "daysInactive": 100}
        _, breakdown = derive_momentum_score(project)
        assert "cleanTree" not in breakdown

    def test_pushed_up_bonus(self) -> None:
        project = {"ahead": 0, "daysInactive": 100}
        _, breakdown = derive_momentum_score(project)
        assert breakdown["pushedUp"] == 15

    def test_unpushed_no_bonus(self) -> None:
        project = {"ahead": 3, "daysInactive": 100}
        _, breakdown = derive_momentum_score(project)
        assert "pushedUp" not in breakdown

    def test_low_branches_bonus(self) -> None:
        project = {"branchCount": 2, "daysInactive": 100}
        _, breakdown = derive_momentum_score(project)
        assert breakdown["lowBranches"] == 10

    def test_many_branches_no_bonus(self) -> None:
        project = {"branchCount": 10, "daysInactive": 100}
        _, breakdown = derive_momentum_score(project)
        assert "lowBranches" not in breakdown

    def test_none_days_inactive(self) -> None:
        """daysInactive=None gives no recency points."""
        project = {"daysInactive": None}
        _, breakdown = derive_momentum_score(project)
        assert "recency" not in breakdown


# ── derive_health_score ───────────────────────────────────


class TestDeriveHealthScore:
    def test_weighted_average(self) -> None:
        """Health = round(0.65 * hygiene + 0.35 * momentum)."""
        project = {
            "files": {"readme": True, "tests": True},
            "cicd": {},
            "deployment": {},
            "todoCount": 5,
            "daysInactive": 5,
            "isDirty": False,
            "ahead": 0,
            "branchCount": 2,
        }
        health, hygiene, momentum, _ = derive_health_score(project)
        assert health == round(0.65 * hygiene + 0.35 * momentum)

    def test_returns_all_four_values(self) -> None:
        health, hygiene, momentum, breakdown = derive_health_score({})
        assert isinstance(health, int)
        assert isinstance(hygiene, int)
        assert isinstance(momentum, int)
        assert "hygiene" in breakdown
        assert "momentum" in breakdown


# ── derive_tags ───────────────────────────────────────────


class TestDeriveTags:
    def test_language_tags(self) -> None:
        project = {"languages": {"detected": ["TypeScript", "Python"]}}
        tags = derive_tags(project)
        assert "typescript" in tags
        assert "python" in tags

    def test_docker_tag(self) -> None:
        project = {"files": {"dockerfile": True}}
        assert "docker" in derive_tags(project)

    def test_docker_compose_tag(self) -> None:
        project = {"files": {"dockerCompose": True}}
        assert "docker" in derive_tags(project)

    def test_cicd_tag(self) -> None:
        project = {"cicd": {"github_actions": True}}
        assert "ci-cd" in derive_tags(project)

    def test_deployed_tag(self) -> None:
        project = {"deployment": {"vercel": True}}
        assert "deployed" in derive_tags(project)

    def test_tested_tag(self) -> None:
        project = {"files": {"tests": True}}
        assert "tested" in derive_tags(project)

    def test_framework_tag(self) -> None:
        project = {"framework": "Next.js"}
        assert "next.js" in derive_tags(project)

    def test_services_tag(self) -> None:
        project = {"services": ["PostgreSQL", "Redis"]}
        tags = derive_tags(project)
        assert "postgresql" in tags
        assert "redis" in tags

    def test_deduplication_and_sorting(self) -> None:
        project = {
            "languages": {"detected": ["Python", "Python"]},
            "framework": "Python",
        }
        tags = derive_tags(project)
        assert tags == sorted(set(tags))
        assert tags.count("python") == 1

    def test_empty_project_no_tags(self) -> None:
        assert derive_tags({}) == []
