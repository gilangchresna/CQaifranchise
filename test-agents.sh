#!/bin/bash
# AIFrCQ Agent Testing - Quick Run Script
# Usage: ./test-agents.sh [option]

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     AIFrCQ Agent Testing Script                       ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/.."

if [ "$1" == "--all" ] || [ -z "$1" ]; then
    echo "Running ALL tests..."
    node scripts/test-agents.js --all
elif [ "$1" == "--pos" ]; then
    echo "Running POS test only..."
    node scripts/test-agents.js --pos
elif [ "$1" == "--agents" ]; then
    echo "Running Agent tests only..."
    node scripts/test-agents.js --agents
elif [ "$1" == "--cases" ]; then
    echo "Running Cases test only..."
    node scripts/test-agents.js --cases
elif [ "$1" == "--verify" ]; then
    echo "Verifying system status only..."
    node scripts/test-agents.js --verify
elif [ "$1" == "--help" ]; then
    echo "Usage: ./test-agents.sh [option]"
    echo ""
    echo "Options:"
    echo "  --all      Run all tests (default)"
    echo "  --pos      Test POS data generation"
    echo "  --agents   Test ML agents (coordinator, SLA, Athena)"
    echo "  --cases    Test case management"
    echo "  --verify   Verify system status only"
    echo "  --help     Show this help"
else
    echo "Unknown option: $1"
    echo "Run './test-agents.sh --help' for usage"
    exit 1
fi
