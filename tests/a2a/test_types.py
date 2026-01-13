"""Tests for A2A type definitions and serialization."""

import pytest
from datetime import datetime

from src.a2a.types import (
    TaskState,
    AgentCard,
    AgentSkill,
    AgentCapabilities,
    AgentProvider,
    A2AMessage,
    A2ATask,
    TaskStatus,
    TextPart,
    FilePart,
    DataPart,
)


class TestTaskState:
    """Tests for TaskState enum."""

    def test_all_states_exist(self):
        """Verify all A2A v0.3 states are defined."""
        expected_states = [
            "submitted", "working", "input_required", "auth_required",
            "completed", "failed", "canceled", "rejected",
        ]
        actual_states = [s.value for s in TaskState]
        for state in expected_states:
            assert state in actual_states, f"Missing state: {state}"

    def test_terminal_states(self):
        """Verify terminal states are correctly identified."""
        terminal = TaskState.terminal_states()
        assert TaskState.COMPLETED in terminal
        assert TaskState.FAILED in terminal
        assert TaskState.CANCELED in terminal
        assert TaskState.REJECTED in terminal
        assert TaskState.WORKING not in terminal
        assert TaskState.SUBMITTED not in terminal

    def test_active_states(self):
        """Verify active states are correctly identified."""
        active = TaskState.active_states()
        assert TaskState.SUBMITTED in active
        assert TaskState.WORKING in active
        assert TaskState.INPUT_REQUIRED in active
        assert TaskState.AUTH_REQUIRED in active
        assert TaskState.COMPLETED not in active
        assert TaskState.FAILED not in active

    def test_is_terminal_method(self):
        """Test is_terminal() instance method."""
        assert TaskState.COMPLETED.is_terminal() is True
        assert TaskState.FAILED.is_terminal() is True
        assert TaskState.WORKING.is_terminal() is False
        assert TaskState.SUBMITTED.is_terminal() is False


class TestAgentSkill:
    """Tests for AgentSkill dataclass."""

    def test_create_skill(self):
        """Test basic skill creation."""
        skill = AgentSkill(
            id="test-skill",
            name="Test Skill",
            description="A test skill",
            tags=["test", "demo"],
            examples=["Example 1", "Example 2"],
        )
        assert skill.id == "test-skill"
        assert skill.name == "Test Skill"
        assert len(skill.tags) == 2
        assert len(skill.examples) == 2

    def test_skill_to_dict(self):
        """Test skill serialization."""
        skill = AgentSkill(
            id="skill-1",
            name="Skill One",
            description="First skill",
        )
        data = skill.to_dict()
        assert data["id"] == "skill-1"
        assert data["name"] == "Skill One"
        assert "description" in data

    def test_skill_from_dict(self):
        """Test skill deserialization."""
        data = {
            "id": "skill-2",
            "name": "Skill Two",
            "description": "Second skill",
            "tags": ["tag1"],
        }
        skill = AgentSkill.from_dict(data)
        assert skill.id == "skill-2"
        assert skill.tags == ["tag1"]


class TestAgentCard:
    """Tests for AgentCard dataclass."""

    def test_create_agent_card(self, sample_agent_card):
        """Test agent card creation from dict."""
        card = AgentCard(
            id=sample_agent_card["id"],
            name=sample_agent_card["name"],
            description=sample_agent_card["description"],
            provider=AgentProvider(
                organization=sample_agent_card["provider"]["organization"],
                url=sample_agent_card["provider"]["url"],
            ),
            skills=[
                AgentSkill(
                    id=s["id"],
                    name=s["name"],
                    description=s["description"],
                    tags=s.get("tags", []),
                    examples=s.get("examples", []),
                )
                for s in sample_agent_card["skills"]
            ],
        )
        assert card.id == "test-agent"
        assert card.name == "Test Agent"
        assert len(card.skills) == 1

    def test_agent_card_to_dict(self):
        """Test agent card serialization."""
        card = AgentCard(
            id="agent-1",
            name="Agent One",
            description="First agent",
            provider=AgentProvider(
                organization="Test Org",
                url="https://test.com",
            ),
        )
        data = card.to_dict()
        assert data["id"] == "agent-1"
        assert "provider" in data
        assert data["provider"]["organization"] == "Test Org"

    def test_agent_card_default_values(self):
        """Test agent card has sensible defaults."""
        card = AgentCard(
            id="minimal",
            name="Minimal Agent",
            description="Minimal description",
            provider=AgentProvider(organization="Org"),
        )
        assert card.skills == []
        assert card.priority == 0
        assert card.role is None


class TestMessageParts:
    """Tests for message part types."""

    def test_text_part(self):
        """Test TextPart creation and serialization."""
        part = TextPart(text="Hello, world!")
        data = part.to_dict()
        assert data["type"] == "text"
        assert data["text"] == "Hello, world!"

    def test_file_part(self):
        """Test FilePart creation and serialization."""
        part = FilePart(
            name="test.txt",
            mimeType="text/plain",
            uri="file:///tmp/test.txt",
        )
        data = part.to_dict()
        assert data["type"] == "file"
        assert data["file"]["name"] == "test.txt"
        assert data["file"]["mimeType"] == "text/plain"

    def test_data_part(self):
        """Test DataPart creation and serialization."""
        part = DataPart(data={"key": "value", "count": 42})
        data = part.to_dict()
        assert data["type"] == "data"
        assert data["data"]["key"] == "value"
        assert data["data"]["count"] == 42


class TestA2AMessage:
    """Tests for A2AMessage dataclass."""

    def test_create_message(self):
        """Test message creation."""
        msg = A2AMessage(
            role="user",
            parts=[TextPart(text="Test message")],
        )
        assert msg.role == "user"
        assert len(msg.parts) == 1

    def test_message_to_dict(self):
        """Test message serialization."""
        msg = A2AMessage(
            role="agent",
            parts=[
                TextPart(text="Response text"),
                DataPart(data={"result": "success"}),
            ],
            sourceAgentId="agent-1",
        )
        data = msg.to_dict()
        assert data["role"] == "agent"
        assert len(data["parts"]) == 2
        assert data["sourceAgentId"] == "agent-1"

    def test_message_with_context(self):
        """Test message with context data."""
        msg = A2AMessage(
            role="user",
            parts=[TextPart(text="Query")],
            context={"session_id": "sess-123", "user_id": "user-456"},
        )
        assert msg.context["session_id"] == "sess-123"


class TestTaskStatus:
    """Tests for TaskStatus dataclass."""

    def test_create_status(self):
        """Test status creation."""
        status = TaskStatus(
            state=TaskState.WORKING,
            timestamp=datetime.utcnow(),
        )
        assert status.state == TaskState.WORKING
        assert status.timestamp is not None

    def test_status_with_message(self):
        """Test status with message."""
        status = TaskStatus(
            state=TaskState.FAILED,
            timestamp=datetime.utcnow(),
            message="Something went wrong",
        )
        data = status.to_dict()
        assert data["state"] == "failed"
        assert data["message"] == "Something went wrong"


class TestA2ATask:
    """Tests for A2ATask dataclass."""

    def test_create_task(self):
        """Test task creation."""
        task = A2ATask(
            id="task-123",
            status=TaskStatus(state=TaskState.SUBMITTED),
        )
        assert task.id == "task-123"
        assert task.status.state == TaskState.SUBMITTED

    def test_task_with_history(self):
        """Test task with message history."""
        task = A2ATask(
            id="task-456",
            status=TaskStatus(state=TaskState.COMPLETED),
            history=[
                A2AMessage(role="user", parts=[TextPart(text="Query")]),
                A2AMessage(role="agent", parts=[TextPart(text="Response")]),
            ],
        )
        assert len(task.history) == 2
        assert task.history[0].role == "user"
        assert task.history[1].role == "agent"

    def test_task_to_dict(self):
        """Test task serialization."""
        task = A2ATask(
            id="task-789",
            contextId="ctx-123",
            status=TaskStatus(state=TaskState.WORKING),
            metadata={"priority": "high"},
        )
        data = task.to_dict()
        assert data["id"] == "task-789"
        assert data["contextId"] == "ctx-123"
        assert data["metadata"]["priority"] == "high"
