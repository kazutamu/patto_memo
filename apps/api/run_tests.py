#!/usr/bin/env python3
"""
Test runner script for the Motion Detector API.
Provides convenient commands to run different types of tests.
"""

import subprocess
import sys


def run_command(cmd, description):
    """Run a command and return the result."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"Command: {' '.join(cmd)}")
    print("=" * 60)

    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


def main():
    """Main test runner."""
    if len(sys.argv) < 2:
        print(
            """
Usage: python run_tests.py <command>

Commands:
  all           - Run all tests with coverage
  unit          - Run only unit tests
  integration   - Run only integration tests
  models        - Run only model validation tests
  uploads       - Run only file upload tests
  fast          - Run fast tests only (no slow tests)
  coverage      - Run tests with detailed coverage report
  verbose       - Run tests with verbose output
  help          - Show this help message

Examples:
  python run_tests.py all
  python run_tests.py unit
  python run_tests.py models
        """
        )
        return

    command = sys.argv[1].lower()

    # Base pytest command
    base_cmd = ["python", "-m", "pytest"]

    if command == "help":
        main()
        return
    elif command == "all":
        cmd = base_cmd + ["--cov=main", "--cov-report=html", "--cov-report=term"]
        run_command(cmd, "All tests with coverage")
    elif command == "unit":
        cmd = base_cmd + ["-m", "unit"]
        run_command(cmd, "Unit tests only")
    elif command == "integration":
        cmd = base_cmd + ["-m", "integration"]
        run_command(cmd, "Integration tests only")
    elif command == "models":
        cmd = base_cmd + ["tests/test_models.py", "-v"]
        run_command(cmd, "Model validation tests")
    elif command == "uploads":
        cmd = base_cmd + ["tests/test_file_uploads.py", "-v"]
        run_command(cmd, "File upload tests")
    elif command == "fast":
        cmd = base_cmd + ["-m", "not slow"]
        run_command(cmd, "Fast tests only")
    elif command == "coverage":
        cmd = base_cmd + [
            "--cov=main",
            "--cov-report=html:htmlcov",
            "--cov-report=term-missing",
            "--cov-fail-under=80",
        ]
        run_command(cmd, "Tests with detailed coverage")
    elif command == "verbose":
        cmd = base_cmd + ["-v", "-s"]
        run_command(cmd, "Verbose test output")
    else:
        print(f"Unknown command: {command}")
        print("Use 'python run_tests.py help' for usage information")


if __name__ == "__main__":
    main()
